import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  getUserById,
  listUserCertifications,
  listUserTrainingHistory,
  updateUser,
} from "@/db/queries";
import { getUserSkillMatrix } from "@/lib/agents/evaluator/skill-matrix";

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  profileBio: z.string().max(4000).optional().nullable(),
  profileLocation: z.string().max(255).optional().nullable(),
  profilePublic: z.boolean().optional(),
  linkedinUrl: z.string().max(500).optional().nullable(),
  portfolioUrl: z.string().max(2000).optional().nullable(),
  resumeUrl: z.string().max(2000).optional().nullable(),
  jobSearchExperienceLevel: z.string().max(64).optional().nullable(),
  image: z.string().max(2000).optional().nullable(),
  notifyEmail: z.boolean().optional(),
  notifyBrowser: z.boolean().optional(),
  slackNotificationsEnabled: z.boolean().optional(),
});

function emptyToNull(v: string | null | undefined): string | null {
  if (v === undefined) return null;
  if (v === "") return null;
  return v;
}

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(session.user.id);
  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [matrix, certifications, trainingHistory] = await Promise.all([
    getUserSkillMatrix(userId),
    listUserCertifications(userId),
    listUserTrainingHistory(userId),
  ]);

  const { passwordHash: _passwordHash, ...safe } = user;
  void _passwordHash;
  return NextResponse.json({ user: safe, matrix, certifications, trainingHistory });
}

export async function PATCH(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = Number(session.user.id);
  const d = parsed.data;
  const row = await updateUser(userId, {
    ...(d.name !== undefined ? { name: d.name } : {}),
    ...(d.profileBio !== undefined ? { profileBio: emptyToNull(d.profileBio) } : {}),
    ...(d.profileLocation !== undefined
      ? { profileLocation: emptyToNull(d.profileLocation) }
      : {}),
    ...(d.profilePublic !== undefined ? { profilePublic: d.profilePublic } : {}),
    ...(d.linkedinUrl !== undefined ? { linkedinUrl: emptyToNull(d.linkedinUrl) } : {}),
    ...(d.portfolioUrl !== undefined ? { portfolioUrl: emptyToNull(d.portfolioUrl) } : {}),
    ...(d.resumeUrl !== undefined ? { resumeUrl: emptyToNull(d.resumeUrl) } : {}),
    ...(d.jobSearchExperienceLevel !== undefined
      ? { jobSearchExperienceLevel: emptyToNull(d.jobSearchExperienceLevel) }
      : {}),
    ...(d.image !== undefined ? { image: emptyToNull(d.image) } : {}),
    ...(d.notifyEmail !== undefined ? { notifyEmail: d.notifyEmail } : {}),
    ...(d.notifyBrowser !== undefined ? { notifyBrowser: d.notifyBrowser } : {}),
    ...(d.slackNotificationsEnabled !== undefined
      ? { slackNotificationsEnabled: d.slackNotificationsEnabled }
      : {}),
  });

  if (!row) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  const { passwordHash: _passwordHash, ...safe } = row;
  void _passwordHash;
  return NextResponse.json({ user: safe });
}
