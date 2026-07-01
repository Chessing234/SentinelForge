import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function runNpmScript(script: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    const child = spawn("npm", ["run", script], {
      cwd: process.cwd(),
      env: process.env,
      shell: true,
    });

    child.stdout?.on("data", (d: Buffer) => chunks.push(d.toString()));
    child.stderr?.on("data", (d: Buffer) => chunks.push(d.toString()));
    child.on("close", (code) => {
      resolve({ ok: code === 0, output: chunks.join("").slice(-4000) });
    });
  });
}

/**
 * One-time remote seed for hosts where SSH / one-off jobs are unavailable (Render free tier).
 * Set SEED_SECRET on the service, then:
 *   curl -X POST https://your-app.onrender.com/api/admin/seed \
 *     -H "x-seed-secret: YOUR_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"enhanced":true}'
 */
export async function POST(request: Request): Promise<Response> {
  const expected = process.env.SEED_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "SEED_SECRET not configured on server" },
      { status: 503 },
    );
  }

  const provided =
    request.headers.get("x-seed-secret")?.trim() ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let enhanced = true;
  try {
    const body = (await request.json()) as { enhanced?: boolean };
    if (body.enhanced === false) enhanced = false;
  } catch {
    /* default enhanced=true */
  }

  const base = await runNpmScript("db:seed");
  if (!base.ok) {
    return NextResponse.json(
      { error: "db:seed failed", output: base.output },
      { status: 500 },
    );
  }

  let enhancedResult: { ok: boolean; output: string } | null = null;
  if (enhanced) {
    enhancedResult = await runNpmScript("db:seed:enhanced");
    if (!enhancedResult.ok) {
      return NextResponse.json(
        { error: "db:seed:enhanced failed", output: enhancedResult.output, base: "ok" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    seeded: true,
    enhanced,
    message: "Demo users ready. Login: student1@state.edu / password123",
  });
}
