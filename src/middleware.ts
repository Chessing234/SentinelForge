import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { recordApiRequest } from "@/lib/metrics";
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

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const requestId = globalThis.crypto.randomUUID();
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  const isLoggedIn = Boolean(token?.sub);
  const role = typeof token?.role === "string" ? token.role : undefined;
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/") &&
    pathname !== "/api/health" &&
    !pathname.startsWith("/api/billing/webhook")
  ) {
    recordApiRequest();
    const ip = clientIp(request);
    const preset = pathname.startsWith("/api/auth") ? "auth" : "api";
    const rl = checkRateLimit(ip, preset, pathname.slice(0, 64));
    if (!rl.ok) {
      return applySecurityHeaders(
        NextResponse.json(
          {
            success: false,
            error: { code: "RATE_LIMITED", message: "Too many requests" },
          },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
        ),
        requestId,
      );
    }
  }

  if (pathname.startsWith("/dashboard") && !isLoggedIn) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/login", request.url)), requestId);
  }

  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      return applySecurityHeaders(NextResponse.redirect(new URL("/login", request.url)), requestId);
    }
    const allowed = role === "admin" || role === "enterprise_admin";
    if (!allowed) {
      return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)), requestId);
    }
  }

  if (pathname.startsWith("/dashboard/admin") || pathname.startsWith("/dashboard/scenarios/builder")) {
    if (!isLoggedIn) {
      return applySecurityHeaders(NextResponse.redirect(new URL("/login", request.url)), requestId);
    }
    if (role !== "admin") {
      return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)), requestId);
    }
  }

  if (pathname.startsWith("/dashboard/billing")) {
    if (!isLoggedIn) {
      return applySecurityHeaders(NextResponse.redirect(new URL("/login", request.url)), requestId);
    }
    if (role !== "enterprise_admin") {
      return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard/settings", request.url)), requestId);
    }
  }

  if (pathname.startsWith("/dashboard/hiring")) {
    if (!isLoggedIn) {
      return applySecurityHeaders(NextResponse.redirect(new URL("/login", request.url)), requestId);
    }
    if (role !== "admin" && role !== "enterprise_admin") {
      return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)), requestId);
    }
  }

  if (
    pathname.startsWith("/dashboard/team") ||
    pathname.startsWith("/dashboard/analytics")
  ) {
    if (!isLoggedIn) {
      return applySecurityHeaders(NextResponse.redirect(new URL("/login", request.url)), requestId);
    }
    if (!role || !instructorRoles.has(role)) {
      return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)), requestId);
    }
  }

  const isPublicApi =
    pathname.startsWith("/api/auth") ||
    pathname === "/api/health" ||
    pathname === "/api/register" ||
    pathname.startsWith("/api/slack/oauth") ||
    pathname.startsWith("/api/slack/events") ||
    pathname.startsWith("/api/slack/commands") ||
    pathname.startsWith("/api/slack/actions") ||
    pathname.startsWith("/api/billing/webhook");
  if (pathname.startsWith("/api") && !isPublicApi && !isLoggedIn) {
    return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), requestId);
  }

  return applySecurityHeaders(NextResponse.next(), requestId);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
