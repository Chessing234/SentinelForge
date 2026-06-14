import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { getOrganizationBySlug } from "@/db/queries";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensurePersonalOrganization } from "@/lib/ensure-personal-org";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  orgCode: z.string().optional(),
});

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, email, password, orgCode } = parsed.data;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let organizationId: number | null = null;
  if (orgCode && orgCode.trim() !== "") {
    const org = await getOrganizationBySlug(orgCode.trim().toLowerCase());
    if (!org) {
      return NextResponse.json({ error: "Invalid organization code" }, { status: 400 });
    }
    organizationId = org.id;
  }

  const [created] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash,
      role: "student",
      organizationId,
    })
    .returning({ id: users.id });

  if (!created) {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }

  if (!organizationId) {
    await ensurePersonalOrganization(created.id, name);
  }

  const row = await db.query.users.findFirst({
    where: eq(users.id, created.id),
  });

  if (!row) {
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }

  return NextResponse.json(
    {
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        organizationId: row.organizationId,
        image: row.image,
        createdAt: row.createdAt,
      },
    },
    { status: 201 },
  );
}
