import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import { auth } from "@/auth";
import { startEnvironmentTrainingSession } from "@/lib/agents/environment/start-session";

type PageProps = {
  searchParams: Promise<{ scenarioId?: string }>;
};

export default async function SimulatorNewPage({
  searchParams,
}: PageProps): Promise<ReactElement> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const sp = await searchParams;
  const scenarioId = Number(sp.scenarioId);
  if (!Number.isFinite(scenarioId) || scenarioId <= 0) {
    redirect("/dashboard/scenarios");
  }

  const userId = Number(session.user.id);
  const orgId =
    session.user.organizationId === null || session.user.organizationId === undefined
      ? null
      : Number(session.user.organizationId);

  const started = await startEnvironmentTrainingSession({
    userId,
    organizationId: orgId,
    scenarioId,
  });

  if (!started.ok) {
    redirect("/dashboard/scenarios");
  }

  redirect(`/dashboard/training/${started.sessionId}`);
}
