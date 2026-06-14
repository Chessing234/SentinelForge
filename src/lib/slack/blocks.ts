import type { KnownBlock } from "@slack/web-api";

export function dashboardUrl(path: string): string {
  const base = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  const root = base.startsWith("http") ? base : `https://${base}`;
  return `${root.replace(/\/$/, "")}${path}`;
}

export function trainingStartBlock(
  scenarioName: string,
  difficulty: string,
  userName: string,
  estimatedMinutes: number,
  sessionId: number,
): KnownBlock[] {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Training session started", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${userName}* started *${scenarioName}* (${difficulty}).`,
      },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "View progress" },
        action_id: "view_progress",
        value: String(sessionId),
      },
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `Estimated duration: ~${estimatedMinutes} min` },
      ],
    },
  ];
}

export function flagFoundBlock(
  scenarioName: string,
  flagNumber: number,
  totalFlags: number,
  score: number | null,
): KnownBlock[] {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Flag discovered!", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Flag *${flagNumber}* of *${totalFlags}* in *${scenarioName}*.`,
      },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `Current score: *${score ?? "—"}*` }],
    },
  ];
}

export function sessionCompleteBlock(params: {
  userName: string;
  scenarioName: string;
  score: number;
  grade: string;
  timeSpent: string;
  hintsUsed: number;
  sessionId: number;
}): KnownBlock[] {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Training session complete", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${params.userName}* finished *${params.scenarioName}* with score *${params.score}* (grade *${params.grade}*).`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Score*\n${params.score}` },
        { type: "mrkdwn", text: `*Grade*\n${params.grade}` },
        { type: "mrkdwn", text: `*Time*\n${params.timeSpent}` },
        { type: "mrkdwn", text: `*Hints used*\n${params.hintsUsed}` },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View full report" },
          action_id: "view_report",
          value: String(params.sessionId),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Share results" },
          style: "primary",
          action_id: "share_results",
          value: String(params.sessionId),
        },
      ],
    },
  ];
}

export type LeaderboardRow = { rank: number; name: string; sessions: number; avgScore: number | null };

export function teamLeaderboardBlock(organizationName: string, topUsers: LeaderboardRow[]): KnownBlock[] {
  const lines = topUsers
    .map((u) => `${u.rank}. *${u.name}* — ${u.sessions} sessions, avg ${u.avgScore ?? "—"}`)
    .join("\n");
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Weekly training leaderboard", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${organizationName}*\n${lines || "_No completed sessions yet._"}`,
      },
    },
    { type: "context", elements: [{ type: "mrkdwn", text: "Keep up the great work!" }] },
  ];
}

export function incidentSimulationBlock(
  scenarioName: string,
  description: string,
  scenarioId: number,
): KnownBlock[] {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: ":rotating_light: Incident simulation alert", emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${scenarioName}*\n${description.slice(0, 500)}` },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Join exercise" },
          style: "danger",
          action_id: "join_exercise",
          value: String(scenarioId),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "View details" },
          url: dashboardUrl("/dashboard/scenarios"),
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "This is a training exercise. Respond as you would in a real incident.",
        },
      ],
    },
  ];
}

export type DigestStats = {
  sessionsCompleted: number;
  avgTeamScore: number | null;
  topPerformer: string | null;
  upcomingHint: string;
};

export function weeklyDigestBlock(stats: DigestStats): KnownBlock[] {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Weekly training digest", emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Sessions completed*\n${stats.sessionsCompleted}` },
        { type: "mrkdwn", text: `*Avg team score*\n${stats.avgTeamScore ?? "—"}` },
        { type: "mrkdwn", text: `*Top performer*\n${stats.topPerformer ?? "—"}` },
        { type: "mrkdwn", text: `*Upcoming*\n${stats.upcomingHint}` },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View analytics" },
          url: dashboardUrl("/dashboard/analytics"),
        },
      ],
    },
  ];
}
