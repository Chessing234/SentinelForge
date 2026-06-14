import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations, users } from "@/db/schema";

export async function ensurePersonalOrganization(
  userId: number,
  displayName: string,
): Promise<void> {
  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!existing || existing.organizationId) {
    return;
  }

  const slug = `user-${userId}`;
  const [organization] = await db
    .insert(organizations)
    .values({
      name: `${displayName.trim().split(/\s+/)[0] ?? "User"}'s Workspace`,
      slug,
      plan: "free",
    })
    .returning();

  if (!organization) {
    return;
  }

  await db
    .update(users)
    .set({ organizationId: organization.id })
    .where(eq(users.id, userId));
}
