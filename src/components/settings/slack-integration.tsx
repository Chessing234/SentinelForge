"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

type SlackSettings = {
  connected: boolean;
  slackTeamName: string | null;
  slackTeamId?: string;
  channelId: string | null;
  notificationSettings: Record<string, boolean> | null;
};

const defaultSettings: Record<string, boolean> = {
  trainingStarted: true,
  flagFound: true,
  sessionCompleted: true,
  weeklyDigest: true,
  incidentSimulations: true,
};

export function SlackIntegration(): ReactElement {
  const { isAdmin, isEnterpriseAdmin, isLoading: authLoading } = useAuth();
  const canManage = isAdmin || isEnterpriseAdmin;
  const [data, setData] = useState<SlackSettings | null>(null);
  const [channelId, setChannelId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/slack/settings");
      const json = (await res.json()) as SlackSettings & { error?: string };
      if (!res.ok) {
        setMessage(json.error ?? "Failed to load Slack settings");
        setData(null);
        return;
      }
      setData(json);
      setChannelId(json.channelId ?? "");
    } catch {
      setMessage("Failed to load Slack settings");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const slack = p.get("slack");
    if (slack === "connected") setMessage("Slack workspace connected.");
    if (slack === "error") setMessage(p.get("message") ?? "Slack connection failed.");
  }, []);

  const notif = { ...defaultSettings, ...(data?.notificationSettings ?? {}) };

  async function patchSlack(body: Record<string, unknown>): Promise<boolean> {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/slack/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? "Save failed");
        return false;
      }
      setData(json as SlackSettings);
      setChannelId((json as SlackSettings).channelId ?? "");
      setMessage("Saved.");
      return true;
    } catch {
      setMessage("Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveChannelOnly(): Promise<void> {
    if (!data?.connected) return;
    await patchSlack({ channelId: channelId.trim() || null });
  }

  async function setToggle(key: keyof typeof notif, value: boolean): Promise<void> {
    if (!data?.connected) return;
    await patchSlack({
      notificationSettings: {
        ...notif,
        [key]: value,
      },
    });
  }

  async function disconnect(): Promise<void> {
    if (!window.confirm("Disconnect Slack from this organization?")) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/slack/settings", { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json();
        setMessage(j.error ?? "Disconnect failed");
        return;
      }
      setData({ connected: false, slackTeamName: null, channelId: null, notificationSettings: null });
      setChannelId("");
      setMessage("Slack disconnected.");
    } catch {
      setMessage("Disconnect failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest(): Promise<void> {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/slack/test", { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        setMessage(j.error ?? "Test failed");
        return;
      }
      setMessage("Test message sent to your default channel.");
    } catch {
      setMessage("Test failed");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return <p className="text-sm text-slate-400">Loading Slack integration…</p>;
  }

  if (!canManage) {
    return (
      <p className="text-sm text-slate-400">
        Only organization admins can manage the Slack integration.
      </p>
    );
  }

  return (
    <Card className="border-slate-800 bg-slate-950/60">
      <CardHeader>
        <CardTitle className="text-white">Slack</CardTitle>
        <CardDescription className="text-slate-400">
          Training alerts, slash commands, and leaderboards in your SOC workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {message ? <p className="text-sm text-slate-300">{message}</p> : null}

        {data?.connected ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-white">Connected workspace</p>
              <p className="text-sm text-slate-400">
                {data.slackTeamName ?? data.slackTeamId ?? "Slack team"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slack-channel" className="text-slate-200">
                Default notification channel ID
              </Label>
              <Input
                id="slack-channel"
                className="border-slate-700 bg-slate-900 text-white"
                placeholder="C0123456789"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Use the channel ID (starts with C) where the bot should post team notifications.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-white">Notification types</p>
              {(
                [
                  ["trainingStarted", "Training started"],
                  ["flagFound", "Flags found"],
                  ["sessionCompleted", "Session completed"],
                  ["weeklyDigest", "Weekly digest"],
                  ["incidentSimulations", "Incident simulations"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600"
                    checked={Boolean(notif[key])}
                    onChange={(e) => void setToggle(key, e.target.checked)}
                    disabled={saving}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => void saveChannelOnly()}
              >
                Save channel
              </Button>
              <Button type="button" variant="outline" disabled={saving} onClick={() => void sendTest()}>
                Send test notification
              </Button>
              <Button type="button" variant="destructive" disabled={saving} onClick={() => void disconnect()}>
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Connect Slack to send training updates to a channel.</p>
            <Button type="button" onClick={() => (window.location.href = "/api/slack/install")}>
              Connect Slack
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
