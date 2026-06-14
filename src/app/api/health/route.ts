import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let database: "up" | "down" = "down";
  try {
    await db.execute(sql`select 1`);
    database = "up";
  } catch {
    database = "down";
  }

  return NextResponse.json({
    status: "ok",
    database,
    timestamp: new Date().toISOString(),
  });
}
