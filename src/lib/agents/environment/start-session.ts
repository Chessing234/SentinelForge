import { adversaryAgent } from "@/lib/agents/adversary";
import { createSession, createSessionEvent, getScenarioById } from "@/db/queries";
import { environmentAgent, type EnvironmentOverview } from "@/lib/agents/environment";

export type StartEnvironmentSessionResult =
  | { ok: true; sessionId: number; overview: EnvironmentOverview }
  | { ok: false; error: "scenario_not_found" | "create_failed" };

export async function startEnvironmentTrainingSession(params: {
  userId: number;
  organizationId: number | null;
  scenarioId: number;
}): Promise<StartEnvironmentSessionResult> {
  const scenario = await getScenarioById(params.scenarioId);
  if (!scenario?.isActive) {
    return { ok: false, error: "scenario_not_found" };
  }

  const row = await createSession({
    userId: params.userId,
    scenarioId: scenario.id,
    organizationId: params.organizationId,
    status: "pending",
  });

  if (!row) {
    return { ok: false, error: "create_failed" };
  }

  const { overview } = await environmentAgent.initialize(row.id);
  await createSessionEvent({
    sessionId: row.id,
    eventType: "environment_ready",
    payload: { overview },
  });

  await adversaryAgent.planAttack(row.id, params.userId);

  return { ok: true, sessionId: row.id, overview };
}
