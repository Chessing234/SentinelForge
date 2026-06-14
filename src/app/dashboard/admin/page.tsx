import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import { OrgSuspendButton } from "@/components/admin/org-actions";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { ScenarioActiveToggle } from "@/components/admin/scenario-active-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/auth";
import { getAdminMetricsSnapshot } from "@/lib/admin-metrics";
import {
  getPlatformStats,
  listOrganizationsWithMemberCounts,
  listScenariosForAdmin,
  listUsersForAdminFilters,
} from "@/db/queries";

export const metadata: Metadata = {
  title: "Admin | SentinelForge",
};

function revenueForOrg(plan: string, seats: number, members: number): number {
  const rate = plan === "enterprise" ? 500 : plan === "academic" ? 50 : 0;
  return rate * Math.min(seats, Math.max(members, 1));
}

export default async function DashboardAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; org?: string }>;
}): Promise<ReactElement> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return <p className="text-slate-400">Forbidden</p>;
  }

  const sp = await searchParams;
  const q = sp.q;
  const role = sp.role;
  const rawOrg = sp.org;
  const orgFilter =
    rawOrg && rawOrg.trim() !== "" && Number.isFinite(Number(rawOrg)) ? Number(rawOrg) : undefined;

  const [stats, orgs, scenarios, users, metrics] = await Promise.all([
    getPlatformStats(),
    listOrganizationsWithMemberCounts(),
    listScenariosForAdmin(),
    listUsersForAdminFilters({
      search: q,
      role: role ?? "all",
      organizationId: orgFilter && Number.isFinite(orgFilter) ? orgFilter : undefined,
      limit: 200,
    }),
    getAdminMetricsSnapshot(),
  ]);

  let revenueTotal = 0;
  for (const o of orgs) {
    revenueTotal += revenueForOrg(o.plan, o.seatLimit, o.memberCount);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Admin panel</h1>
        <p className="mt-1 text-sm text-slate-400">
          Organizations, billing signals, platform health, and user management.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xs text-slate-400">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{stats.userCount}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xs text-slate-400">Scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{stats.scenarioCount}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xs text-slate-400">Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{stats.sessionCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-white">Financial overview</CardTitle>
          <CardDescription className="text-slate-400">
            MRR is estimated from plan × seat limit (Stripe is source of truth when connected).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-slate-500">MRR (est.)</p>
            <p className="text-2xl font-semibold text-emerald-400">
              ${(metrics.mrrCents / 100).toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Active paid orgs: {metrics.activeSubscriptions} · Churn (placeholder):{" "}
              {metrics.churnRatePercent}%
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Platform revenue (model)</p>
            <p className="text-2xl font-semibold text-white">${revenueTotal.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Sum of org estimates (seats × plan rate)</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Training activity (month)</p>
            <p className="text-sm text-slate-300">
              Sessions completed: {metrics.usage.sessionsCompletedThisMonth}
            </p>
            <p className="text-sm text-slate-300">Active users: {metrics.usage.activeUsersThisMonth}</p>
          </div>
          <div className="lg:col-span-3">
            <p className="mb-2 text-xs font-medium uppercase text-slate-500">Revenue trend (model)</p>
            <RevenueChart data={metrics.revenueByMonth} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-white">Organizations</CardTitle>
          <CardDescription className="text-slate-400">Plans, seats, and quick actions.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400">Name</TableHead>
                <TableHead className="text-slate-400">Plan</TableHead>
                <TableHead className="text-slate-400">Users</TableHead>
                <TableHead className="text-slate-400">Seats</TableHead>
                <TableHead className="text-slate-400">Revenue (est.)</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((o) => (
                <TableRow key={o.id} className="border-slate-800">
                  <TableCell className="text-slate-200">{o.name}</TableCell>
                  <TableCell className="capitalize text-slate-400">{o.plan}</TableCell>
                  <TableCell className="text-slate-400">{o.memberCount}</TableCell>
                  <TableCell className="text-slate-400">{o.seatLimit}</TableCell>
                  <TableCell className="text-slate-300">
                    ${revenueForOrg(o.plan, o.seatLimit, o.memberCount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {o.suspended ? "Suspended" : "Active"}
                    {o.billingStatus ? ` · ${o.billingStatus}` : ""}
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Link
                      href={`/dashboard/admin?org=${o.id}`}
                      className="text-xs text-emerald-400 hover:underline"
                    >
                      View users
                    </Link>
                    <OrgSuspendButton organizationId={o.id} suspended={Boolean(o.suspended)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-white">System health</CardTitle>
          <CardDescription className="text-slate-400">
            Live-ish metrics from this Node process; wire Datadog/Grafana in production.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-500">API requests (since deploy)</p>
            <p className="text-xl font-semibold text-white">{metrics.api.requestsSinceDeploy}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-500">Avg response (placeholder)</p>
            <p className="text-xl font-semibold text-white">{metrics.api.avgResponseMs} ms</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-500">Error rate (placeholder)</p>
            <p className="text-xl font-semibold text-white">{metrics.api.errorRatePercent}%</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-500">WebSocket connections</p>
            <p className="text-xl font-semibold text-white">{metrics.realtime.websocketConnections}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-500">DB pool (configured max)</p>
            <p className="text-xl font-semibold text-white">
              {metrics.realtime.dbPool.active} active / {metrics.realtime.dbPool.idle} idle / max{" "}
              {metrics.realtime.dbPool.max}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-white">User management</CardTitle>
          <CardDescription className="text-slate-400">
            Filter with query params: <code className="text-slate-300">?q=&role=&org=</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap gap-2" method="get" action="/dashboard/admin">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search name or email"
              className="h-9 min-w-[200px] rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
            />
            <select
              name="role"
              defaultValue={role ?? "all"}
              className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-white"
            >
              <option value="all">All roles</option>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="enterprise_admin">Enterprise admin</option>
              <option value="admin">Admin</option>
            </select>
            <input
              name="org"
              defaultValue={orgFilter !== undefined ? String(orgFilter) : ""}
              placeholder="Org ID"
              className="h-9 w-24 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-white"
            />
            <button
              type="submit"
              className="h-9 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Apply
            </button>
          </form>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Name</TableHead>
                  <TableHead className="text-slate-400">Email</TableHead>
                  <TableHead className="text-slate-400">Role</TableHead>
                  <TableHead className="text-slate-400">Org ID</TableHead>
                  <TableHead className="text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="border-slate-800">
                    <TableCell className="text-slate-200">{u.name}</TableCell>
                    <TableCell className="text-slate-400">{u.email}</TableCell>
                    <TableCell className="capitalize text-slate-400">{u.role}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {u.organizationId ?? "—"}
                    </TableCell>
                    <TableCell className="space-x-2 text-xs text-slate-500">
                      <span title="Open user profile in a future release">View profile</span>
                      <span title="Impersonation not enabled in this build">· Impersonate</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-white">Scenarios</CardTitle>
          <p className="text-sm text-slate-400">Toggle availability for the scenario browser.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400">ID</TableHead>
                <TableHead className="text-slate-400">Name</TableHead>
                <TableHead className="text-slate-400">Difficulty</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarios.map((s) => (
                <TableRow key={s.id} className="border-slate-800">
                  <TableCell className="font-mono text-xs text-slate-500">{s.id}</TableCell>
                  <TableCell className="text-slate-200">{s.name}</TableCell>
                  <TableCell className="capitalize text-slate-400">{s.difficulty}</TableCell>
                  <TableCell>
                    <ScenarioActiveToggle id={s.id} initial={s.isActive} />
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
