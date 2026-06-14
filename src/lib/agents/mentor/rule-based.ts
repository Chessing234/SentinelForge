import { getMitreTechnique } from "@/lib/agents/adversary/mitre";
import type { MentorContext } from "@/lib/agents/mentor/context-builder";
import { generateHint } from "@/lib/agents/mentor/hint-system";

const CONCEPTS: Record<string, string> = {
  xss: "Cross-site scripting lets an attacker run script in another user's browser context. Defenses include encoding output, CSP, and HTTP-only cookies for sessions.",
  sqli:
    "SQL injection abuses string concatenation in queries. Prefer parameterized queries/ORM bindings and least-privilege DB accounts.",
  phishing:
    "Phishing tricks users into credentials or execution. Train users, use MFA, and verify sender identity and URLs before acting.",
  ransomware:
    "Ransomware encrypts data for impact. Backups, segmentation, and EDR visibility on mass file modification help response.",
  "privilege escalation":
    "Privilege escalation moves from limited access to higher rights. Patch, remove SUID clutter, and audit sudoers and scheduled tasks.",
  persistence:
    "Persistence keeps access across reboots. Inspect startup locations, scheduled tasks, services, and unexpected accounts.",
  "lateral movement":
    "Lateral movement reuses credentials or exploits between hosts. Look for RDP/SSH bursts, PsExec patterns, and token reuse.",
  "command and control":
    "C2 is outbound communication to an attacker controller. DNS anomalies, rare domains, and beaconing intervals are common tells.",
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function progressiveHintRound(ctx: MentorContext): 1 | 2 | 3 {
  const n = ctx.hintsGiven;
  if (n >= 4) return 3;
  if (n >= 2) return 2;
  return 1;
}

export function getRuleBasedResponse(sessionId: number, ctx: MentorContext, message: string): string {
  const m = normalize(message);

  if (/what\s+is\s+mitre\s*(t[\d.]+)/i.test(message)) {
    const id = message.match(/T[\d.]+/i)?.[0];
    if (id) {
      const tech = getMitreTechnique(id);
      if (tech) {
        return `${tech.id} — ${tech.name} (${tech.tactic}): ${tech.description} Example procedures: ${tech.procedures.slice(0, 2).join("; ")}.`;
      }
    }
  }

  const mitreBare = message.match(/\bT[\d.]{3,}(?:\.\d{3})?\b/i)?.[0];
  if (mitreBare) {
    const tech = getMitreTechnique(mitreBare);
    if (tech) {
      return `${tech.name}: ${tech.description} (Tactic: ${tech.tactic}). Think about what telemetry you'd expect if this technique occurred in your lab.`;
    }
  }

  if (m.includes("what is ") || m.includes("explain ")) {
    const tail = message.replace(/^.*(what is|explain)\s+/i, "").replace(/\?+$/, "");
    const key = normalize(tail).replace(/[^a-z0-9 ]/g, "");
    for (const [k, v] of Object.entries(CONCEPTS)) {
      if (key.includes(k)) return v;
    }
    return `Here's a concise frame for "${tail.trim()}": define the threat, typical attacker actions, what benign can look like, and 2–3 concrete checks you'd run in this lab. Which part do you want to zoom in on first?`;
  }

  if (/how (do|to) (use|run) (nmap|netstat|ps|grep|ssh|hydra|sqlmap)/i.test(message)) {
    const tool = message.match(/nmap|netstat|ps|grep|ssh|hydra|sqlmap/i)?.[0]?.toLowerCase() ?? "your tool";
    const guides: Record<string, string> = {
      nmap: "nmap: start with `-sn` for discovery, then targeted `-sV -p <ports>` on interesting hosts. Document open ports and versions before guessing exploits.",
      netstat:
        "netstat: `netstat -an` shows sockets; pair listening ports with services you expect. Unexpected ESTABLISHED rows deserve process correlation.",
      ps: "ps: `ps aux --sort=-%cpu | head` surfaces busy processes; filter by user and look for odd paths under /tmp or home.",
      grep: "grep: search logs and configs for IOC strings; always anchor patterns and avoid grepping huge binaries blindly.",
      ssh: "ssh: `ssh user@host` then verify host keys out-of-band in real life; in-lab, enumerate users and watch auth logs for failures.",
      hydra: "hydra: only against lab targets with permission; narrow user/password lists and tune threads to avoid locking accounts.",
      sqlmap: "sqlmap: start with risk/level low, confirm injection class, and never point it at systems you don't own.",
    };
    return guides[tool] ?? `For ${tool}, read the simulated man page output in-terminal, run with minimal flags first, and interpret stdout like evidence—not noise.`;
  }

  if (m.includes("stuck") || m.includes("help") || m.includes("hint")) {
    const h = generateHint(sessionId, progressiveHintRound(ctx), ctx);
    return h.content;
  }

  if (m.includes("what should i do") || m.includes("next step")) {
    return "Work in loops: (1) expand visibility on one host, (2) form a hypothesis, (3) test with a narrow command, (4) record what changed. If you share your last command output theme (ports, files, users), I can tighten the loop—without naming the flag.";
  }

  if (m.includes("on track") || m.includes("am i right")) {
    if (ctx.skillLevel === "advanced") {
      return "You're moving quickly—great. Keep documenting assumptions and validate with a second signal so a lucky guess doesn't become a habit.";
    }
    if (ctx.skillLevel === "struggling") {
      return "It's okay to slow down. Pick one artifact class (network OR filesystem OR auth) and stay with it for two iterations before switching.";
    }
    return "Your pacing looks reasonable. Tie each finding to the scenario storyline and MITRE tactic—narrative helps prioritization.";
  }

  if (m.includes("what tool")) {
    if (!ctx.recentCommands.some((c) => /nmap/i.test(c))) {
      return "Start with broad discovery (host/port view), then pivot to process and connection inspection on the most interesting host.";
    }
    if (!ctx.recentCommands.some((c) => /netstat|ss /i.test(c))) {
      return "Next, inventory sockets on a host you care about—listening and established rows tell different stories.";
    }
    return "You're deep enough to correlate: pick one suspicious line from ps or netstat and chase its file path and parent process.";
  }

  if (m.includes("suspicious") || m.includes("/tmp/") || m.includes("backdoor")) {
    const low = m;
    const pathMatch = message.match(/(\/[\w./-]+)/);
    const p = pathMatch?.[1] ?? "that path";
    if (/backdoor|payload|\.sh$/i.test(low)) {
      return `${p} is a good instinct to scrutinize: writable dirs launching scripts are common in classes. Corroborate with ownership, recent mtime, and whether a parent process explains why it exists—I'm not confirming malice, just how analysts decide.`;
    }
    return `For "${message.slice(0, 120)}", compare against expected baseline for this host role. Two agreeing signals (path + process, or process + network) beat one noisy string.`;
  }

  if (m.includes("flag")) {
    return "I can't spell flags. Search the environment like an analyst: follow evidence chains until a token matches the expected format, then submit with the flag command.";
  }

  if (m.includes("password") || m.includes("credential")) {
    return "Credential topics: check for default accounts, weak ssh keys, reused passwords, and auth log patterns. In IR you'd also rotate secrets once confirmed.";
  }

  if (m.includes("log")) {
    return "Logs reward targeted reads: filter by time window around an event, then widen. Look for bursts of failures followed by a success.";
  }

  if (m.includes("mitre")) {
    return "MITRE ATT&CK is a behavior taxonomy—map observations to tactics first, then techniques. That ordering keeps hypotheses testable.";
  }

  if (m.includes("thank")) {
    return "You're welcome—curiosity is the best SIEM rule. What did you learn from your last command that surprised you?";
  }

  return `I read: "${message.slice(0, 200)}". Try one focused question (tool + target + what you want to learn). I'll steer without spoiling the lab token.`;
}
