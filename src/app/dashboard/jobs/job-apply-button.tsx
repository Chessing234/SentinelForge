"use client";

import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type JobApplyButtonProps = {
  jobId: number;
  disabled: boolean;
};

export function JobApplyButton({ jobId, disabled }: JobApplyButtonProps): ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onApply(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        alert(j.error ?? "Could not apply");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      className="bg-emerald-600 hover:bg-emerald-500"
      disabled={disabled || loading}
      onClick={() => void onApply()}
    >
      {loading ? "Applying…" : "Apply now"}
    </Button>
  );
}
