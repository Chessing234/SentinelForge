import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySlackSignature(params: {
  signingSecret: string;
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
}): boolean {
  const { signingSecret, rawBody, timestamp, signature } = params;
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) {
    return false;
  }
  const base = `v0:${timestamp}:${rawBody}`;
  const hmac = createHmac("sha256", signingSecret).update(base).digest("hex");
  const expected = `v0=${hmac}`;
  try {
    const a = Uint8Array.from(Buffer.from(expected, "utf8"));
    const b = Uint8Array.from(Buffer.from(signature, "utf8"));
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
