import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getAdminMetricsSnapshot } from "@/lib/admin-metrics";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snapshot = await getAdminMetricsSnapshot();
  return NextResponse.json(snapshot);
}
