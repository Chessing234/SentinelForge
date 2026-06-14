import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter } from "@auth/core/adapters";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import bcrypt from "bcryptjs";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Slack from "next-auth/providers/slack";
import { z } from "zod";

import { db } from "@/db";
import {
  accounts,
  authSessions,
  users,
  verificationTokens,
} from "@/db/schema";
import { ensurePersonalOrganization } from "@/lib/ensure-personal-org";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const providers: NextAuthConfig["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET) {
  providers.push(
    Slack({
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    }),
  );
}

providers.push(
  Credentials({
    id: "credentials",
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: async (credentials) => {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) {
        return null;
      }
      const { email, password } = parsed.data;
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
      if (!user?.passwordHash) {
        return null;
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return null;
      }
      return {
        id: String(user.id),
        email: user.email,
        name: user.name,
        image: user.image ?? undefined,
      };
    },
  }),
);

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  adapter: DrizzleAdapter(
    db,
    {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: authSessions,
      verificationTokensTable: verificationTokens,
    } as never,
  ) as Adapter,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers,
  callbacks: {
    signIn: async () => true,
    async jwt({ token, user }) {
      if (user?.id) {
        const id = Number.parseInt(String(user.id), 10);
        if (Number.isFinite(id)) {
          const row = await db.query.users.findFirst({
            where: eq(users.id, id),
          });
          if (row) {
            token.sub = String(row.id);
            token.role = row.role;
            token.organizationId = row.organizationId;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.sub ?? "");
        session.user.role = String(token.role ?? "student");
        session.user.organizationId =
          token.organizationId === undefined
            ? null
            : (token.organizationId as number | null);
      }
      return session;
    },
  },
  events: {
    signIn: async ({ user, account, isNewUser }) => {
      console.info("[auth] signIn", {
        userId: user.id,
        provider: account?.provider,
        isNewUser,
      });
    },
    createUser: async ({ user }) => {
      const id = Number.parseInt(String(user.id), 10);
      if (!Number.isFinite(id)) {
        return;
      }
      try {
        await ensurePersonalOrganization(id, user.name ?? "User");
      } catch (error) {
        console.error("[auth] createUser organization bootstrap failed:", error);
      }
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
