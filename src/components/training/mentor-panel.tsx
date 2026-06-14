"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { MentorResponse } from "@/lib/agents/mentor";
import { Loader2, Send, Shield, Sparkles } from "lucide-react";

export type MentorMessageRow = {
  id: number;
  role: "user" | "mentor" | "system";
  content: string;
  createdAt: string;
  metadata?: unknown;
};

type MentorPanelProps = {
  sessionId: number;
  initialMessages: MentorMessageRow[];
  onOpenConcept?: (topic: string) => void;
  /** When set, chat uses this transport (e.g. Socket.IO) instead of SSE stream. */
  chatViaSocket?: (text: string) => Promise<MentorResponse>;
};

type StreamMentorPayload = {
  token?: string;
  done?: boolean;
  mentor?: {
    message: string;
    hintGiven: boolean;
    conceptExplained: string | null;
    encouragement: boolean;
    suggestedCommands: string[];
  };
  error?: string;
};

function parseSseBlock(block: string): StreamMentorPayload | null {
  const line = block
    .split("\n")
    .find((l) => l.startsWith("data:"))
    ?.slice(5)
    .trim();
  if (!line) return null;
  try {
    return JSON.parse(line) as StreamMentorPayload;
  } catch {
    return null;
  }
}

export function MentorPanel({
  sessionId,
  initialMessages,
  onOpenConcept,
  chatViaSocket,
}: MentorPanelProps): ReactElement {
  const [messages, setMessages] = useState<MentorMessageRow[]>(
    initialMessages.filter((m) => m.role === "user" || m.role === "mentor"),
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  const refreshHistory = useCallback(async () => {
    const res = await fetch(`/api/agents/mentor/conversations?sessionId=${sessionId}`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { messages: MentorMessageRow[] };
    setMessages(data.messages.filter((m) => m.role === "user" || m.role === "mentor"));
  }, [sessionId]);

  const sendStream = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setPending("");
    const optimisticId = Date.now();
    setMessages((m) => [
      ...m,
      {
        id: optimisticId,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      if (chatViaSocket) {
        try {
          await chatViaSocket(trimmed);
        } catch {
          setError("Mentor is temporarily unavailable. Try again.");
          setMessages((m) => m.filter((x) => x.id !== optimisticId));
          return;
        }
        await refreshHistory();
        return;
      }

      const res = await fetch("/api/agents/mentor/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, message: trimmed }),
      });
      if (!res.ok || !res.body) {
        setError("Mentor is temporarily unavailable. Try again.");
        setMessages((m) => m.filter((x) => x.id !== optimisticId));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const payload = parseSseBlock(part);
          if (!payload) continue;
          if (payload.error) {
            setError(payload.error);
            break;
          }
          if (payload.token) {
            assembled += payload.token;
            setPending(assembled);
          }
          if (payload.done && payload.mentor?.message) {
            assembled = payload.mentor.message;
          }
        }
      }

      setPending("");
      await refreshHistory();
    } catch {
      setError("Mentor is temporarily unavailable. Try again.");
      setMessages((m) => m.filter((x) => x.id !== optimisticId));
    } finally {
      setLoading(false);
      setPending("");
    }
  };

  const quick = (payload: string) => {
    if (payload === "Explain the technique" && onOpenConcept) {
      onOpenConcept("MITRE ATT&CK technique for this scenario");
      return;
    }
    void sendStream(payload);
  };

  return (
    <div className="flex h-full min-h-[420px] flex-col border-l border-slate-800 bg-slate-950/80">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <Shield className="h-5 w-5" aria-hidden />
          <Sparkles className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-emerald-300" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-white">SentinelForge Mentor</p>
          <p className="text-[10px] text-slate-500">Guidance without spoilers</p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 py-2">
        <div className="space-y-3 pr-2">
          {messages.length === 0 && !pending ? (
            <p className="text-center text-sm text-slate-500">Ask me anything about this scenario!</p>
          ) : null}
          {messages.map((m) => (
            <div
              key={`${m.id}-${m.createdAt}`}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                  m.role === "user"
                    ? "bg-emerald-600/25 text-emerald-50"
                    : "border border-slate-800 bg-slate-900 text-slate-100",
                )}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {pending ? (
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100">
                <p className="whitespace-pre-wrap">{pending}</p>
                <Loader2 className="mt-1 h-4 w-4 animate-spin text-emerald-400" aria-label="Typing" />
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {error ? <p className="px-3 py-1 text-center text-xs text-amber-400">{error}</p> : null}

      <div className="space-y-2 border-t border-slate-800 p-3">
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => quick("I need a hint")}
          >
            I need a hint
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => quick("Explain the technique")}
          >
            Explain the technique
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => quick("Am I on track?")}
          >
            Am I on track?
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => quick("What tool should I use next?")}
          >
            What tool should I use?
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendStream(input);
                setInput("");
              }
            }}
            placeholder="Ask about IOCs, tools, or concepts…"
            className="border-slate-700 bg-slate-900 text-sm text-white"
            disabled={loading}
          />
          <Button
            type="button"
            size="icon"
            className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-500"
            disabled={loading}
            onClick={() => {
              void sendStream(input);
              setInput("");
            }}
            aria-label="Send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
