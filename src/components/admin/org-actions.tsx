"use client";

import type { ReactElement } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function OrgSuspendButton(props: { organizationId: number; suspended: boolean }): ReactElement {
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState(props.suspended);

  async function toggle(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orgs/${props.organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: !suspended }),
      });
      if (res.ok) {
        setSuspended((s) => !s);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={suspended ? "secondary" : "destructive"}
      disabled={loading}
      onClick={() => void toggle()}
    >
      {suspended ? "Unsuspend" : "Suspend"}
    </Button>
  );
}
