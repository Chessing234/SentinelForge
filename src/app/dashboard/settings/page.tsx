import type { Metadata } from "next";
import type { ReactElement } from "react";

import { SettingsTabs } from "@/components/settings/settings-tabs";

export const metadata: Metadata = {
  title: "Settings | SentinelForge",
};

export default function SettingsPage(): ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-slate-400">
          Profile, organization, Slack integration, notification channels, and billing.
        </p>
      </div>
      <SettingsTabs />
    </div>
  );
}
