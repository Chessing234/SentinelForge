import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import { auth } from "@/auth";
import {
  getUserById,
  listUserCertifications,
  listUserTrainingHistory,
} from "@/db/queries";
import { getUserSkillMatrix } from "@/lib/agents/evaluator/skill-matrix";

import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Profile | SentinelForge",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}): Promise<ReactElement> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const sp = await searchParams;
  const preview = sp.preview === "1";
  const userId = Number(session.user.id);

  const row = await getUserById(userId);
  if (!row) {
    redirect("/dashboard");
  }
  const { passwordHash: _passwordHash, ...safeUser } = row;
  void _passwordHash;

  const [matrix, certifications, trainingHistory] = await Promise.all([
    getUserSkillMatrix(userId),
    listUserCertifications(userId),
    listUserTrainingHistory(userId),
  ]);

  return (
    <ProfileForm
      preview={preview}
      initialUser={safeUser}
      matrix={matrix}
      certifications={certifications}
      trainingHistory={trainingHistory}
    />
  );
}
