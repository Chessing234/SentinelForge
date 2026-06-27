import type { Metadata } from "next";
import type { ReactElement } from "react";

import { RoleBadge } from "@/components/auth/role-badge";
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
import { getOrganizationById, getOrganizationMembers } from "@/db/queries";

export const metadata: Metadata = {
  title: "Team | SentinelForge",
};

export default async function TeamPage(): Promise<ReactElement> {
  const session = await auth();
  const orgId = session?.user?.organizationId ?? null;

  if (!orgId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Team management</h1>
        <p className="text-slate-400">
          You are not assigned to an organization. Platform admins can browse all orgs from the{" "}
          <a href="/dashboard/admin" className="text-emerald-400 hover:underline">
            admin panel
          </a>
          .
        </p>
      </div>
    );
  }

  const [org, members] = await Promise.all([
    getOrganizationById(orgId),
    getOrganizationMembers(orgId),
  ]);

  const seatUsed = members.length;
  const seatLimit = org?.seatLimit ?? 0;
  const seatPct = seatLimit > 0 ? Math.min(100, Math.round((seatUsed / seatLimit) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Team management</h1>
        <p className="mt-1 text-sm text-slate-400">
          {org?.name ?? "Organization"} · {seatUsed} of {seatLimit} seats used ({seatPct}%)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xs text-slate-400">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{seatUsed}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xs text-slate-400">Seat limit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{seatLimit}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xs text-slate-400">Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold capitalize text-white">{org?.plan ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-white">Roster</CardTitle>
          <CardDescription className="text-slate-400">
            Learners and instructors in your organization. Invite flows can extend this table in
            production.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400">Name</TableHead>
                <TableHead className="text-slate-400">Email</TableHead>
                <TableHead className="text-slate-400">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id} className="border-slate-800">
                  <TableCell className="text-slate-200">{m.name}</TableCell>
                  <TableCell className="text-slate-400">{m.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={m.role} />
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
