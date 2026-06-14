export type ParsedCommand =
  | { kind: "empty" }
  | { kind: "flag"; value: string }
  | { kind: "shell"; program: string; args: string[]; raw: string };

/**
 * Tokenize and map trainee input to a structured command (case-insensitive program).
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { kind: "empty" };
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("flag ") || lower.startsWith("submit ")) {
    const value = trimmed.split(/\s+/).slice(1).join(" ").trim();
    if (!value) {
      return { kind: "shell", program: "echo", args: ["usage: flag <SF{...}>"], raw: trimmed };
    }
    return { kind: "flag", value };
  }

  const parts = tokenize(trimmed);
  if (parts.length === 0) {
    return { kind: "empty" };
  }

  const program = parts[0]!.toLowerCase();
  const args = parts.slice(1);
  return { kind: "shell", program, args, raw: trimmed };
}

function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]!;
    if (quote) {
      if (c === quote) {
        quote = null;
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      if (cur.trim()) {
        out.push(cur.trim());
        cur = "";
      }
      quote = c as "'" | '"';
      continue;
    }
    if (/\s/.test(c)) {
      if (cur.trim()) {
        out.push(cur.trim());
        cur = "";
      }
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function validateSyntax(parsed: ParsedCommand): { ok: boolean; error?: string } {
  if (parsed.kind === "empty") {
    return { ok: false, error: "Empty command" };
  }
  if (parsed.kind === "flag") {
    if (!/^SF\{[A-Za-z0-9_-]+\}$/.test(parsed.value)) {
      return { ok: false, error: "Flag must look like SF{...}" };
    }
    return { ok: true };
  }
  return { ok: true };
}
