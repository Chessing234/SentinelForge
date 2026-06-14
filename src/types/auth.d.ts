import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
      organizationId: number | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: string;
    organizationId?: number | null;
  }
}
