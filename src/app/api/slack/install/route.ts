import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { generateOAuthState, getInstallUrl } from "@/lib/slack/oauth";

function appOrigin(request: Request): string {
  const env = process.env.NEXTAUTH_URL;
  if (env?.startsWith("http")) return env.replace(/\/$/, "");
  const host = request.headers.get("host");
  if (host) return `https://${host}`;
  return "http://localhost:3000";
}

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role ?? "student";
  if (role !== "enterprise_admin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId =
    session.user.organizationId === null || session.user.organizationId === undefined
      ? null
      : Number(session.user.organizationId);
  if (!orgId) {
    return NextResponse.json({ error: "Organization required" }, { status: 400 });
  }

  const statePayload = generateOAuthState(orgId);
  const redirectUri = `${appOrigin(request)}/api/slack/oauth`;

  let url: string;
  try {
    const inner = JSON.parse(Buffer.from(statePayload, "base64url").toString("utf8")) as {
      state: string;
    };
    url = getInstallUrl(inner.state, redirectUri);
  } catch {
    return NextResponse.json({ error: "State generation failed" }, { status: 500 });
  }

  const jar = await cookies();
  jar.set("slack_oauth", statePayload, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 300,
    path: "/",
  });

  return NextResponse.redirect(url);
}
