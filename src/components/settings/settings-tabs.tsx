"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { SlackIntegration } from "@/components/settings/slack-integration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";

type ProfileUser = {
  name?: string | null;
  profileBio?: string | null;
  notifyEmail?: boolean;
  notifyBrowser?: boolean;
  slackNotificationsEnabled?: boolean;
};

export function SettingsTabs(): ReactElement {
  const { isAdmin, isEnterpriseAdmin } = useAuth();
  const canOrg = isAdmin || isEnterpriseAdmin;

  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="mb-6 flex flex-wrap border border-slate-800 bg-slate-950">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="organization">Organization</TabsTrigger>
        <TabsTrigger value="slack">Slack</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileForm />
      </TabsContent>

      <TabsContent value="organization">
        {canOrg ? <OrganizationForm /> : <p className="text-sm text-slate-400">Organization settings are restricted to admins.</p>}
      </TabsContent>

      <TabsContent value="slack">
        <SlackIntegration />
      </TabsContent>

      <TabsContent value="notifications">
        <NotificationPreferences />
      </TabsContent>

      <TabsContent value="billing">
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader>
            <CardTitle className="text-white">Billing</CardTitle>
            <CardDescription className="text-slate-400">
              Compare plans, manage seats, and open the Stripe customer portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEnterpriseAdmin ? (
              <>
                <p className="text-sm text-slate-400">
                  Enterprise admins can upgrade plans, adjust seats, and manage invoices on the billing page.
                </p>
                <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
                  <a href="/dashboard/billing">Open billing & plans</a>
                </Button>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                Billing is managed by your organization&apos;s enterprise administrator.
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function ProfileForm(): ReactElement {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/user/profile");
        const json = await res.json();
        if (res.ok && json.user) {
          setUser(json.user);
          setName(json.user.name ?? "");
          setBio(json.user.profileBio ?? "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(): Promise<void> {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, profileBio: bio || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(json.error ?? "Save failed");
        return;
      }
      setUser(json.user);
      setStatus("Profile saved.");
    } catch {
      setStatus("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading profile…</p>;

  return (
    <Card className="border-slate-800 bg-slate-950/60">
      <CardHeader>
        <CardTitle className="text-white">Profile</CardTitle>
        <CardDescription className="text-slate-400">Basic information shown across SentinelForge.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status ? <p className="text-sm text-slate-300">{status}</p> : null}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-slate-200">
            Name
          </Label>
          <Input
            id="name"
            className="border-slate-700 bg-slate-900 text-white"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio" className="text-slate-200">
            Bio
          </Label>
          <Textarea
            id="bio"
            className="min-h-[100px] border-slate-700 bg-slate-900 text-white"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <p className="text-xs text-slate-500">Signed in as {user?.name ?? "user"}</p>
        <Button type="button" disabled={saving} onClick={() => void save()}>
          Save profile
        </Button>
      </CardContent>
    </Card>
  );
}

function OrganizationForm(): ReactElement {
  const [name, setName] = useState("");
  const [seatLimit, setSeatLimit] = useState(5);
  const [plan, setPlan] = useState<"free" | "academic" | "enterprise">("free");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/organization");
        const json = await res.json();
        if (res.ok && json.organization) {
          setName(json.organization.name ?? "");
          setSeatLimit(json.organization.seatLimit ?? 5);
          setPlan(json.organization.plan ?? "free");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(): Promise<void> {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, seatLimit, plan }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(json.error ?? "Save failed");
        return;
      }
      setName(json.organization.name ?? "");
      setSeatLimit(json.organization.seatLimit ?? 5);
      setPlan(json.organization.plan ?? "free");
      setStatus("Organization updated.");
    } catch {
      setStatus("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading organization…</p>;

  return (
    <Card className="border-slate-800 bg-slate-950/60">
      <CardHeader>
        <CardTitle className="text-white">Organization</CardTitle>
        <CardDescription className="text-slate-400">Name, seats, and plan for your team.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status ? <p className="text-sm text-slate-300">{status}</p> : null}
        <div className="space-y-2">
          <Label className="text-slate-200">Organization name</Label>
          <Input
            className="border-slate-700 bg-slate-900 text-white"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-200">Seat limit</Label>
          <Input
            type="number"
            min={1}
            className="border-slate-700 bg-slate-900 text-white"
            value={seatLimit}
            onChange={(e) => setSeatLimit(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-200">Plan</Label>
          <select
            className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
            value={plan}
            onChange={(e) => setPlan(e.target.value as typeof plan)}
          >
            <option value="free">Free</option>
            <option value="academic">Academic</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <Button type="button" disabled={saving} onClick={() => void save()}>
          Save organization
        </Button>
      </CardContent>
    </Card>
  );
}

function NotificationPreferences(): ReactElement {
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyBrowser, setNotifyBrowser] = useState(true);
  const [slackNotificationsEnabled, setSlackNotificationsEnabled] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/user/profile");
        const json = await res.json();
        if (res.ok && json.user) {
          setNotifyEmail(json.user.notifyEmail !== false);
          setNotifyBrowser(json.user.notifyBrowser !== false);
          setSlackNotificationsEnabled(json.user.slackNotificationsEnabled !== false);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(): Promise<void> {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyEmail, notifyBrowser, slackNotificationsEnabled }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(json.error ?? "Save failed");
        return;
      }
      setStatus("Notification preferences saved.");
      if (json.user) {
        setNotifyEmail(json.user.notifyEmail !== false);
        setNotifyBrowser(json.user.notifyBrowser !== false);
        setSlackNotificationsEnabled(json.user.slackNotificationsEnabled !== false);
      }
    } catch {
      setStatus("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading preferences…</p>;

  return (
    <Card className="border-slate-800 bg-slate-950/60">
      <CardHeader>
        <CardTitle className="text-white">Notifications</CardTitle>
        <CardDescription className="text-slate-400">
          Choose how SentinelForge reaches you outside the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status ? <p className="text-sm text-slate-300">{status}</p> : null}
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="rounded border-slate-600"
            checked={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.checked)}
          />
          Email notifications
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="rounded border-slate-600"
            checked={notifyBrowser}
            onChange={(e) => setNotifyBrowser(e.target.checked)}
          />
          Browser notifications
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="rounded border-slate-600"
            checked={slackNotificationsEnabled}
            onChange={(e) => setSlackNotificationsEnabled(e.target.checked)}
          />
          Slack training notifications (when your org has Slack connected)
        </label>
        <Button type="button" disabled={saving} onClick={() => void save()}>
          Save preferences
        </Button>
      </CardContent>
    </Card>
  );
}
