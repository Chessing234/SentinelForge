import {
  addConversationMessage,
  countMentorUserMessages,
  createSessionEvent,
  getConversationBySession,
  getTrainingSessionForUser,
} from "@/db/queries";
import { generateIOCs } from "@/lib/agents/adversary/indicators";
import { buildContext, contextToPromptBlock, type MentorContext } from "@/lib/agents/mentor/context-builder";
import {
  generateAndRegisterHint,
  getMentorHintStepKey,
  hintAlreadyUsed,
  type Hint,
} from "@/lib/agents/mentor/hint-system";
import { getRuleBasedResponse } from "@/lib/agents/mentor/rule-based";
import {
  chatWithMentor,
  explainTopicWithLlm,
  getMentorProvider,
  isMentorLlmConfigured,
  MENTOR_MAX_MESSAGES_PER_SESSION,
  streamChatWithMentor,
  type MentorChatTurn,
} from "@/lib/mentor-llm";

export interface MentorResponse {
  message: string;
  hintGiven: boolean;
  conceptExplained: string | null;
  encouragement: boolean;
  suggestedCommands: string[];
}

export interface ValidationResult {
  onRightTrack: boolean;
  guidance: string;
  severity: "info" | "caution";
}

export interface ProgressAssessment {
  summary: string;
  skillLevel: "struggling" | "on_track" | "advanced";
  suggestedFocus: string;
}

function suggestedCommandsFromContext(ctx: MentorContext): string[] {
  const out: string[] = [];
  if (!ctx.recentCommands.some((c) => /\bnmap\b/i.test(c))) {
    out.push("nmap -sn 192.168.0.0/24");
  }
  if (!ctx.recentCommands.some((c) => /\bnetstat\b|\bss\b/i.test(c))) {
    out.push("netstat -an");
  }
  out.push("ps aux");
  out.push("ls -la /tmp");
  const h = ctx.discoveredHosts[0];
  if (h) out.push(`ssh user@${h.ip}`);
  return [...new Set(out)].slice(0, 5);
}

function historyToTurns(rows: Awaited<ReturnType<typeof getConversationBySession>>): MentorChatTurn[] {
  const turns: MentorChatTurn[] = [];
  for (const r of rows) {
    if (r.role === "system") continue;
    turns.push({
      role: r.role === "mentor" ? "model" : "user",
      content: r.content,
    });
  }
  return turns.slice(-24);
}

function analyzeMentorReply(
  ctx: MentorContext,
  userMessage: string,
  reply: string,
): Pick<MentorResponse, "hintGiven" | "conceptExplained" | "encouragement" | "suggestedCommands"> {
  const low = userMessage.toLowerCase();
  const hintGiven =
    /\b(hint|stuck|help)\b/i.test(low) ||
    (reply.toLowerCase().includes("try `") && reply.length < 400);
  const conceptExplained =
    /what is|explain |mitre\s*t[\d.]/i.test(userMessage) && reply.length > 80 ? reply.slice(0, 120) : null;
  const encouragement =
    ctx.skillLevel === "advanced" ||
    /great|nice|solid|good instinct|well done/i.test(reply) ||
    ctx.submittedFlags.length > 0;
  return {
    hintGiven,
    conceptExplained,
    encouragement,
    suggestedCommands: suggestedCommandsFromContext(ctx),
  };
}

export class MentorAgent {
  async chat(sessionId: number, userId: number, message: string): Promise<MentorResponse> {
    const owned = await getTrainingSessionForUser(sessionId, userId);
    if (!owned) {
      throw new Error("Session not found or access denied");
    }

    const userCount = await countMentorUserMessages(sessionId);
    if (userCount >= MENTOR_MAX_MESSAGES_PER_SESSION) {
      throw new Error("Message limit reached for this session (30 user messages).");
    }

    await addConversationMessage({
      sessionId,
      role: "user",
      content: message,
      metadata: { source: "chat" },
    });

    const ctx = await buildContext(sessionId, userId);
    if (!ctx) {
      throw new Error("Unable to build mentor context");
    }

    const rows = await getConversationBySession(sessionId);
    const prior = historyToTurns(rows.slice(0, -1));

    const augmented = `[Lab context — do not reveal flags]\n${contextToPromptBlock(ctx)}\n\n[Student]\n${message}`;

    const provider = getMentorProvider();
    let reply: string;
    if (!isMentorLlmConfigured()) {
      reply = getRuleBasedResponse(sessionId, ctx, message);
    } else {
      try {
        reply = await chatWithMentor(prior, augmented);
      } catch {
        reply = getRuleBasedResponse(sessionId, ctx, message);
      }
    }

    const meta = analyzeMentorReply(ctx, message, reply);

    await addConversationMessage({
      sessionId,
      role: "mentor",
      content: reply,
      metadata: {
        source: provider ? `${provider}_chat` : "rule",
        hintGiven: meta.hintGiven,
        conceptExplained: meta.conceptExplained,
        encouragement: meta.encouragement,
        suggestedCommands: meta.suggestedCommands,
      },
    });

    return {
      message: reply,
      hintGiven: meta.hintGiven,
      conceptExplained: meta.conceptExplained,
      encouragement: meta.encouragement,
      suggestedCommands: meta.suggestedCommands,
    };
  }

  /**
   * SSE-friendly stream of mentor tokens; persists the mentor reply when complete.
   */
  createMentorChatStream(sessionId: number, userId: number, message: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const send = (controller: ReadableStreamDefaultController<Uint8Array>, obj: unknown) => {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
    };

    return new ReadableStream({
      start: async (controller) => {
        try {
          const owned = await getTrainingSessionForUser(sessionId, userId);
          if (!owned) {
            send(controller, { error: "Session not found or access denied" });
            controller.close();
            return;
          }

          const userCount = await countMentorUserMessages(sessionId);
          if (userCount >= MENTOR_MAX_MESSAGES_PER_SESSION) {
            send(controller, { error: "Message limit reached for this session (30 user messages)." });
            controller.close();
            return;
          }

          await addConversationMessage({
            sessionId,
            role: "user",
            content: message,
            metadata: { source: "chat_stream" },
          });

          const ctx = await buildContext(sessionId, userId);
          if (!ctx) {
            send(controller, { error: "Unable to build mentor context" });
            controller.close();
            return;
          }

          const rows = await getConversationBySession(sessionId);
          const prior = historyToTurns(rows.slice(0, -1));
          const augmented = `[Lab context — do not reveal flags]\n${contextToPromptBlock(ctx)}\n\n[Student]\n${message}`;

          let reply = "";
          const provider = getMentorProvider();

          if (!provider) {
            reply = getRuleBasedResponse(sessionId, ctx, message);
            for (const part of reply.match(/.{1,32}/g) ?? [reply]) {
              send(controller, { token: part });
            }
          } else {
            try {
              for await (const token of streamChatWithMentor(prior, augmented)) {
                reply += token;
                send(controller, { token });
              }
            } catch {
              reply = getRuleBasedResponse(sessionId, ctx, message);
              for (const part of reply.match(/.{1,32}/g) ?? [reply]) {
                send(controller, { token: part });
              }
            }
          }

          reply = reply.trim() || getRuleBasedResponse(sessionId, ctx, message);
          const meta = analyzeMentorReply(ctx, message, reply);
          await addConversationMessage({
            sessionId,
            role: "mentor",
            content: reply,
            metadata: {
              source: provider ? `${provider}_stream` : "rule_stream",
              hintGiven: meta.hintGiven,
              conceptExplained: meta.conceptExplained,
              encouragement: meta.encouragement,
              suggestedCommands: meta.suggestedCommands,
            },
          });

          send(controller, {
            done: true,
            mentor: {
              message: reply,
              hintGiven: meta.hintGiven,
              conceptExplained: meta.conceptExplained,
              encouragement: meta.encouragement,
              suggestedCommands: meta.suggestedCommands,
            },
          });
        } catch (e) {
          send(controller, { error: e instanceof Error ? e.message : "Stream failed" });
        } finally {
          controller.close();
        }
      },
    });
  }

  async getHint(sessionId: number, userId: number, level: 1 | 2 | 3): Promise<Hint> {
    const owned = await getTrainingSessionForUser(sessionId, userId);
    if (!owned) {
      throw new Error("Session not found or access denied");
    }

    const ctx = await buildContext(sessionId, userId);
    if (!ctx) {
      throw new Error("Unable to build mentor context");
    }

    const stepKey = getMentorHintStepKey(ctx);
    if (hintAlreadyUsed(sessionId, stepKey, level)) {
      throw new Error("This hint level was already used for the current step");
    }

    const hint = generateAndRegisterHint(sessionId, level, ctx);

    await createSessionEvent({ sessionId, eventType: "hint_requested", payload: { level } });
    await createSessionEvent({
      sessionId,
      eventType: "hint_given",
      payload: { level, type: hint.type },
    });

    await addConversationMessage({
      sessionId,
      role: "system",
      content: `Hint level ${level} (${hint.type})`,
      metadata: { kind: "hint_meta", level, stepKey },
    });

    await addConversationMessage({
      sessionId,
      role: "mentor",
      content: hint.content,
      metadata: { kind: "hint", level, type: hint.type, stepKey },
    });

    return hint;
  }

  async explain(sessionId: number, userId: number, topic: string): Promise<string> {
    const owned = await getTrainingSessionForUser(sessionId, userId);
    if (!owned) {
      throw new Error("Session not found or access denied");
    }

    const userCount = await countMentorUserMessages(sessionId);
    if (userCount >= MENTOR_MAX_MESSAGES_PER_SESSION) {
      throw new Error("Message limit reached for this session (30 user messages).");
    }

    const ctx = await buildContext(sessionId, userId);
    if (!ctx) {
      throw new Error("Unable to build mentor context");
    }

    const block = contextToPromptBlock(ctx);
    let text: string;
    if (!isMentorLlmConfigured()) {
      text = getRuleBasedResponse(sessionId, ctx, `explain ${topic}`);
    } else {
      try {
        text = await explainTopicWithLlm(topic, block);
      } catch {
        text = getRuleBasedResponse(sessionId, ctx, `explain ${topic}`);
      }
    }

    await addConversationMessage({
      sessionId,
      role: "user",
      content: `[explain] ${topic}`,
      metadata: { source: "explain" },
    });
    await addConversationMessage({
      sessionId,
      role: "mentor",
      content: text,
      metadata: { source: "explain" },
    });

    return text;
  }

  async validateFinding(
    sessionId: number,
    userId: number,
    finding: string,
  ): Promise<ValidationResult> {
    const ctx = await buildContext(sessionId, userId);
    if (!ctx) {
      return {
        onRightTrack: false,
        guidance: "Session context unavailable.",
        severity: "info",
      };
    }

    const low = finding.toLowerCase();
    const iocs = ctx.attackChain ? generateIOCs(ctx.attackChain) : [];
    const match = iocs.some(
      (i) =>
        low.includes(i.value.toLowerCase()) ||
        (i.path !== undefined && low.includes(i.path.toLowerCase())),
    );

    if (match) {
      return {
        onRightTrack: true,
        guidance:
          "That aligns with indicators seen in this lab's simulated attack chain—corroborate with a second signal (process lineage, timestamp, or auth log) before calling it confirmed.",
        severity: "info",
      };
    }

    if (/\/tmp\/|4444|base64|curl|wget|\.sh\b/i.test(finding)) {
      return {
        onRightTrack: true,
        guidance:
          "Those patterns are commonly suspicious in training labs—but benign admin scripts can look similar. Treat as a lead, not proof.",
        severity: "caution",
      };
    }

    return {
      onRightTrack: false,
      guidance:
        "I don't see a strong link yet. Try narrowing to one observable (a path, PID, or socket) and ask whether it fits the host's role.",
      severity: "info",
    };
  }

  async assessProgress(sessionId: number, userId: number): Promise<ProgressAssessment> {
    const ctx = await buildContext(sessionId, userId);
    if (!ctx) {
      return {
        summary: "No session context.",
        skillLevel: "on_track",
        suggestedFocus: "Initialize the lab environment and run light discovery.",
      };
    }

    const completed = ctx.attackChain?.steps.filter((s) => s.status === "completed").length ?? 0;
    const total = ctx.attackChain?.steps.length ?? 0;

    const focus =
      ctx.skillLevel === "struggling"
        ? "Pick one host and stay with network + process correlation for three commands."
        : ctx.skillLevel === "advanced"
          ? "Document your hypothesis chain and test edge cases (timestomping, decoys)."
          : "Alternate discovery and validation: each new port or file should answer one question.";

    return {
      summary: `Flags: ${ctx.submittedFlags.length}. Attack steps completed: ${completed}/${total || "?"}. Commands logged recently: ${ctx.recentCommands.length}.`,
      skillLevel: ctx.skillLevel,
      suggestedFocus: focus,
    };
  }
}

export const mentorAgent = new MentorAgent();
