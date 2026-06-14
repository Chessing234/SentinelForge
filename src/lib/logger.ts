type LogContext = Record<string, string | number | boolean | null | undefined>;

const SENSITIVE = /password|token|secret|authorization|cookie/i;

function redact(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE.test(k)) {
      out[k] = "[redacted]";
    } else if (v && typeof v === "object") {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function basePayload(level: string, message: string, context?: LogContext): Record<string, unknown> {
  const isProd = process.env.NODE_ENV === "production";
  return {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context && Object.keys(context).length ? { context: redact(context) as LogContext } : {}),
    ...(isProd ? { service: "sentinelforge" } : {}),
  };
}

export const log = {
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === "production" && process.env.LOG_DEBUG !== "1") return;
    console.debug(JSON.stringify(basePayload("debug", message, context)));
  },
  info(message: string, context?: LogContext): void {
    console.info(JSON.stringify(basePayload("info", message, context)));
  },
  warn(message: string, context?: LogContext): void {
    console.warn(JSON.stringify(basePayload("warn", message, context)));
  },
  error(message: string, context?: LogContext, err?: unknown): void {
    const extra =
      err instanceof Error ? { errName: err.name, errMessage: err.message, errStack: err.stack } : { err };
    console.error(JSON.stringify({ ...basePayload("error", message, context), ...extra }));
  },
};
