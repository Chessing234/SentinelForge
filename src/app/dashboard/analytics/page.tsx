import type { Metadata } from "next";
import type { ReactElement } from "react";

import { auth } from "@/auth";
import { getOrganizationAnalytics } from "@/lib/agents/evaluator/analytics";
import { evaluatorAgent } from "@/lib/agents/evaluator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrgCharts } from "@/components/analytics/org-charts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Team Analytics | SentinelForge",
};

function riskBadge(risk: string): string {
  if (risk === "low") return "bg-emerald-500/20 text-emerald-300";
  if (risk === "medium") return "bg-amber-500/20 text-amber-200";
  return "bg-red-500/20 text-red-300";
}

export default async function AnalyticsPage(): Promise<ReactElement> {
  const session = await auth();
  if (!session?.user?.id) {
    return <p className="text-slate-400">Unauthorized</p>;
  }

  const orgId = session.user.organizationId;
  if (orgId === null || orgId === undefined) {
    return (
      <p className="text-slate-400">
        Join an organization to view enterprise analytics, or contact an administrator.
      </p>
    );
  }

  const analytics = await getOrganizationAnalytics(orgId);
  const team = await evaluatorAgent.getTeamProgress(orgId);
  const csvHref = `/api/agents/evaluator/analytics?organizationId=${orgId}&format=csv`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Team analytics</h1>
          <p className="mt-1 text-sm text-slate-400">Organization-wide training outcomes.</p>
        </div>
        <Button asChild variant="outline" className="border-slate-600">
          <a href={csvHref}>Export CSV</a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total users", value: analytics.totalUsers },
          { label: "Avg score (completed)", value: analytics.averageScore },
          { label: "Sessions (all time)", value: analytics.totalSessions },
          { label: "Completion rate", value: `${analytics.completionRate}%` },
        ].map((s) => (
          <Card key={s.label} className="border-slate-800 bg-slate-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-normal text-slate-400">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-white">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-white">Risk assessment</CardTitle>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium uppercase ${riskBadge(analytics.riskAssessment)}`}
          >
            {analytics.riskAssessment}
          </span>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">
            Derived from average completed-session scores. Active users this month:{" "}
            <span className="text-slate-200">{analytics.activeUsersThisMonth}</span>.
          </p>
        </CardContent>
      </Card>

      <OrgCharts weeklyActivity={analytics.weeklyActivity} categoryBreakdown={analytics.categoryBreakdown} />

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-white">Top performers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400">Name</TableHead>
                <TableHead className="text-slate-400">Avg score</TableHead>
                <TableHead className="text-slate-400">Sessions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.topPerformers.map((p) => (
                <TableRow key={p.userId} className="border-slate-800">
                  <TableCell className="text-slate-200">{p.name}</TableCell>
                  <TableCell className="text-emerald-400">{p.averageScore}</TableCell>
                  <TableCell>{p.sessionsCompleted}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-amber-900/40 bg-amber-950/20">
        <CardHeader>
          <CardTitle className="text-lg text-amber-100">Struggling users</CardTitle>
          <p className="text-sm text-amber-200/80">
            Low average score or stale activity (no completion in 14 days).
          </p>
        </CardHeader>
        <CardContent>
          {analytics.strugglingUsers.length === 0 ? (
            <p className="text-sm text-slate-500">None flagged.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {analytics.strugglingUsers.map((u) => (
                <li key={u.userId} className="flex justify-between text-slate-200">
                  <span>{u.name}</span>
                  <span className="font-mono text-amber-300">{u.averageScore}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-white">Team roster</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400">Name</TableHead>
                <TableHead className="text-slate-400">Role</TableHead>
                <TableHead className="text-slate-400">Sessions</TableHead>
                <TableHead className="text-slate-400">Avg</TableHead>
                <TableHead className="text-slate-400">Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((m) => (
                <TableRow key={m.userId} className="border-slate-800">
                  <TableCell className="text-slate-200">{m.name}</TableCell>
                  <TableCell className="capitalize text-slate-400">{m.role}</TableCell>
                  <TableCell>{m.sessionsCompleted}</TableCell>
                  <TableCell>{m.averageScore ?? "—"}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {m.lastActive ? new Date(m.lastActive).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
