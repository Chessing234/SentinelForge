import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { handleOAuthCallback } from "@/lib/slack/oauth";

function appOrigin(request: Request): string {
  const env = process.env.NEXTAUTH_URL;
  if (env?.startsWith("http")) return env.replace(/\/$/, "");
  const host = request.headers.get("host");
  if (host) return `https://${host}`;
  return "http://localhost:3000";
}

function redirectTo(path: string, request: Request): NextResponse {
  return NextResponse.redirect(new URL(path, appOrigin(request)));
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) {
    return redirectTo(
      `/dashboard/settings?slack=error&message=${encodeURIComponent(err)}`,
      request,
    );
  }
  if (!code || !state) {
    return redirectTo("/dashboard/settings?slack=error&message=missing_params", request);
  }

  const jar = await cookies();
  const cookiePayload = jar.get("slack_oauth")?.value;
  const redirectUri = `${appOrigin(request)}/api/slack/oauth`;

  try {
    await handleOAuthCallback({
      code,
      stateFromQuery: state,
      cookiePayload,
      redirectUri,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_failed";
    return redirectTo(`/dashboard/settings?slack=error&message=${encodeURIComponent(msg)}`, request);
  }

  jar.delete("slack_oauth");
  return redirectTo("/dashboard/settings?slack=connected", request);
}
