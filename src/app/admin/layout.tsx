import { redirect } from "next/navigation";
import type { ReactElement, ReactNode } from "react";

import { auth } from "@/auth";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactElement> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return <>{children}</>;
}
