import {
  createCipheriv,
  createDecipheriv,
  createSecretKey,
  randomBytes,
  scryptSync,
} from "node:crypto";
import type { KeyObject } from "node:crypto";

const PREFIX = "enc:v1:";
const IV_LEN = 12;
const TAG_LEN = 16;

function slackTokenKey(): KeyObject {
  const secret =
    process.env.SLACK_TOKEN_ENCRYPTION_KEY ?? process.env.AUTH_SECRET ?? "sentinelforge-dev-key-change-me";
  const raw = Uint8Array.from(scryptSync(secret, "slack-token-salt", 32));
  return createSecretKey(raw);
}

export function encryptSlackToken(plaintext: string): string {
  const iv = Uint8Array.from(randomBytes(IV_LEN));
  const cipher = createCipheriv("aes-256-gcm", slackTokenKey(), iv);
  const enc = Buffer.concat([
    Uint8Array.from(cipher.update(plaintext, "utf8")),
    Uint8Array.from(cipher.final()),
  ]);
  const tag = Uint8Array.from(cipher.getAuthTag());
  const out = Buffer.concat([iv, tag, Uint8Array.from(enc)]);
  return `${PREFIX}${out.toString("base64")}`;
}

export function decryptSlackToken(stored: string): string {
  if (!stored.startsWith(PREFIX)) {
    return stored;
  }
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = Uint8Array.from(raw.subarray(0, IV_LEN));
  const tag = Uint8Array.from(raw.subarray(IV_LEN, IV_LEN + TAG_LEN));
  const data = Uint8Array.from(raw.subarray(IV_LEN + TAG_LEN));
  const decipher = createDecipheriv("aes-256-gcm", slackTokenKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(data, undefined, "utf8") + decipher.final("utf8");
}
