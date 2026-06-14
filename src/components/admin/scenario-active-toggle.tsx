"use client";

import type { ReactElement } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type ScenarioToggleProps = {
  id: number;
  initial: boolean;
};

export function ScenarioActiveToggle({ id, initial }: ScenarioToggleProps): ReactElement {
  const [active, setActive] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/scenarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, isActive: !active }),
      });
      if (res.ok) setActive((a) => !a);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void toggle()}>
      {active ? "Active" : "Inactive"}
    </Button>
  );
}
