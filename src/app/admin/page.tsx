import type { ReactElement } from "react";

export default function AdminPage(): ReactElement {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Administration</h1>
      <p className="text-muted-foreground">
        Enterprise and platform administration tools will land in later prompts.
      </p>
    </main>
  );
}
