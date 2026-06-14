import { randomBytes } from "node:crypto";

import { getSlackIntegrationByTeamId, upsertSlackIntegration } from "@/db/queries";
import { encryptSlackToken } from "@/lib/slack/token-crypto";

const SLACK_AUTH = "https://slack.com/oauth/v2/authorize";
const SLACK_ACCESS = "https://slack.com/api/oauth.v2.access";

const DEFAULT_SCOPES = [
  "chat:write",
  "chat:write.public",
  "users:read",
  "commands",
  "im:write",
  "app_mentions:read",
  "channels:read",
  "groups:read",
].join(",");

export type SlackOAuthStatePayload = {
  state: string;
  organizationId: number;
  exp: number;
};

export function generateOAuthState(organizationId: number): string {
  const state = randomBytes(24).toString("hex");
  const payload: SlackOAuthStatePayload = {
    state,
    organizationId,
    exp: Date.now() + 5 * 60 * 1000,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function parseAndValidateOAuthState(
  cookieValue: string | undefined,
  queryState: string | null,
): SlackOAuthStatePayload | null {
  if (!cookieValue || !queryState) return null;
  try {
    const raw = Buffer.from(cookieValue, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as SlackOAuthStatePayload;
    if (parsed.state !== queryState) return null;
    if (typeof parsed.organizationId !== "number" || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getInstallUrl(state: string, redirectUri: string): string {
  const clientId = process.env.SLACK_BOT_CLIENT_ID;
  if (!clientId) {
    throw new Error("SLACK_BOT_CLIENT_ID is not configured");
  }
  const u = new URL(SLACK_AUTH);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("scope", DEFAULT_SCOPES);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  return u.toString();
}

export type OAuthExchangeResult = {
  teamId: string;
  teamName: string | null;
  accessToken: string;
  refreshToken: string | null;
};

export async function exchangeOAuthCode(code: string, redirectUri: string): Promise<OAuthExchangeResult> {
  const clientId = process.env.SLACK_BOT_CLIENT_ID;
  const clientSecret = process.env.SLACK_BOT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Slack OAuth client credentials missing");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(SLACK_ACCESS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    ok?: boolean;
    error?: string;
    team?: { id?: string; name?: string };
    access_token?: string;
    refresh_token?: string;
  };
  if (!json.ok || !json.access_token || !json.team?.id) {
    throw new Error(json.error ?? "oauth.v2.access failed");
  }
  return {
    teamId: json.team.id,
    teamName: json.team.name ?? null,
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
  };
}

export async function handleOAuthCallback(params: {
  code: string;
  stateFromQuery: string;
  cookiePayload: string | undefined;
  redirectUri: string;
}): Promise<{ organizationId: number }> {
  const parsed = parseAndValidateOAuthState(params.cookiePayload, params.stateFromQuery);
  if (!parsed) {
    throw new Error("Invalid or expired OAuth state");
  }
  const tokens = await exchangeOAuthCode(params.code, params.redirectUri);
  const enc = encryptSlackToken(tokens.accessToken);
  const encRefresh = tokens.refreshToken ? encryptSlackToken(tokens.refreshToken) : null;
  await upsertSlackIntegration({
    organizationId: parsed.organizationId,
    slackTeamId: tokens.teamId,
    slackTeamName: tokens.teamName,
    accessToken: enc,
    refreshToken: encRefresh,
  });
  return { organizationId: parsed.organizationId };
}

export async function refreshSlackBotToken(teamId: string): Promise<void> {
  const row = await getSlackIntegrationByTeamId(teamId);
  if (!row?.refreshToken) return;
  const clientId = process.env.SLACK_BOT_CLIENT_ID;
  const clientSecret = process.env.SLACK_BOT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;
  const { decryptSlackToken } = await import("@/lib/slack/token-crypto");
  const refresh = decryptSlackToken(row.refreshToken);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refresh,
  });
  const res = await fetch(SLACK_ACCESS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { ok?: boolean; access_token?: string; refresh_token?: string };
  if (!json.ok || !json.access_token) return;
  await upsertSlackIntegration({
    organizationId: row.organizationId,
    slackTeamId: row.slackTeamId,
    slackTeamName: row.slackTeamName,
    accessToken: encryptSlackToken(json.access_token),
    refreshToken: json.refresh_token ? encryptSlackToken(json.refresh_token) : row.refreshToken,
  });
}
