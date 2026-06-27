import { redirect } from "next/navigation";
import type { ReactElement } from "react";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

/** Legacy URL — forward to the live training simulator. */
export default async function SimulatorSessionPage({
  params,
}: PageProps): Promise<ReactElement> {
  const { sessionId } = await params;
  redirect(`/dashboard/training/${sessionId}`);
}
