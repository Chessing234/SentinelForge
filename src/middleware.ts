import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { recordApiRequest, recordApiResponseTime } from "@/lib/metrics";
import { checkRateLimit } from "@/lib/rate-limiter";

const instructorRoles = new Set(["instructor", "admin", "enterprise_admin"]);

function applySecurityHeaders(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("x-request-id", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' ws: wss: https:;",
  );
  return response;
}

function tracksApiMetrics(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") &&
    pathname !== "/api/health" &&
    !pathname.startsWith("/api/billing/webhook")
  );
}

function finish(
  response: NextResponse,
  requestId: string,
  pathname: string,
  startedAt: number,
): NextResponse {
  if (tracksApiMetrics(pathname)) {
    recordApiResponseTime(Date.now() - startedAt, response.status >= 400);
  }
  return applySecurityHeaders(response, requestId);
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const requestId = globalThis.crypto.randomUUID();

  // Over HTTPS, Auth.js stores the session JWT under the `__Secure-`-prefixed
  // cookie and salts the token with that name. The env-derived URL that Auth.js
  // uses to auto-detect secure cookies isn't reliably visible in the Edge
  // middleware context, so we determine it explicitly here — otherwise
  // `getToken` reads the wrong cookie name, finds nothing, and bounces every
  // logged-in user back to /login.
  const secureCookie =
    process.env.NODE_ENV === "production" ||
    request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:";
  const cookieName = secureCookie
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie,
    cookieName,
    salt: cookieName,
  });

  const isLoggedIn = Boolean(token?.sub);
  const role = typeof token?.role === "string" ? token.role : undefined;
  const { pathname } = request.nextUrl;

  if (tracksApiMetrics(pathname)) {
    recordApiRequest();
    const ip = clientIp(request);
    const preset = pathname.startsWith("/api/auth") ? "auth" : "api";
    const rl = checkRateLimit(ip, preset, pathname.slice(0, 64));
    if (!rl.ok) {
      return finish(
        NextResponse.json(
          {
            success: false,
            error: { code: "RATE_LIMITED", message: "Too many requests" },
          },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
        ),
        requestId,
        pathname,
        startedAt,
      );
    }
  }

  if (pathname.startsWith("/dashboard") && !isLoggedIn) {
    return finish(NextResponse.redirect(new URL("/login", request.url)), requestId, pathname, startedAt);
  }

  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      return finish(NextResponse.redirect(new URL("/login", request.url)), requestId, pathname, startedAt);
    }
    const allowed = role === "admin" || role === "enterprise_admin";
    if (!allowed) {
      return finish(NextResponse.redirect(new URL("/dashboard", request.url)), requestId, pathname, startedAt);
    }
  }

  if (pathname.startsWith("/dashboard/admin") || pathname.startsWith("/dashboard/scenarios/builder")) {
    if (!isLoggedIn) {
      return finish(NextResponse.redirect(new URL("/login", request.url)), requestId, pathname, startedAt);
    }
    if (role !== "admin") {
      return finish(NextResponse.redirect(new URL("/dashboard", request.url)), requestId, pathname, startedAt);
    }
  }

  if (pathname.startsWith("/dashboard/billing")) {
    if (!isLoggedIn) {
      return finish(NextResponse.redirect(new URL("/login", request.url)), requestId, pathname, startedAt);
    }
    if (role !== "enterprise_admin") {
      return finish(
        NextResponse.redirect(new URL("/dashboard/settings", request.url)),
        requestId,
        pathname,
        startedAt,
      );
    }
  }

  if (pathname.startsWith("/dashboard/hiring")) {
    if (!isLoggedIn) {
      return finish(NextResponse.redirect(new URL("/login", request.url)), requestId, pathname, startedAt);
    }
    if (role !== "admin" && role !== "enterprise_admin") {
      return finish(NextResponse.redirect(new URL("/dashboard", request.url)), requestId, pathname, startedAt);
    }
  }

  if (
    pathname.startsWith("/dashboard/team") ||
    pathname.startsWith("/dashboard/analytics")
  ) {
    if (!isLoggedIn) {
      return finish(NextResponse.redirect(new URL("/login", request.url)), requestId, pathname, startedAt);
    }
    if (!role || !instructorRoles.has(role)) {
      return finish(NextResponse.redirect(new URL("/dashboard", request.url)), requestId, pathname, startedAt);
    }
  }

  const isPublicApi =
    pathname.startsWith("/api/auth") ||
    pathname === "/api/health" ||
    pathname === "/api/register" ||
    pathname === "/api/admin/seed" ||
    pathname.startsWith("/api/slack/oauth") ||
    pathname.startsWith("/api/slack/events") ||
    pathname.startsWith("/api/slack/commands") ||
    pathname.startsWith("/api/slack/actions") ||
    pathname.startsWith("/api/billing/webhook");
  if (pathname.startsWith("/api") && !isPublicApi && !isLoggedIn) {
    return finish(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), requestId, pathname, startedAt);
  }

  return finish(NextResponse.next(), requestId, pathname, startedAt);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
