import { redirect } from "next/navigation";
import type { ReactElement } from "react";

/** Legacy admin route — platform admin lives under the dashboard. */
export default function AdminPage(): ReactElement {
  redirect("/dashboard/admin");
}
