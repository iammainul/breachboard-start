import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      platformRole: string;
      organizationId: string | null;
      authEpoch?: number;
      activitySessionId?: string;
      activityExpiresAt?: number;
    } & DefaultSession["user"];
  }

  interface User {
    platformRole?: string;
    organizationId?: string | null;
    authEpoch?: number;
    activitySessionId?: string;
    activityExpiresAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    platformRole?: string;
    organizationId?: string | null;
    authEpoch?: number;
    sessionRevoked?: boolean;
    activitySessionId?: string;
    activityExpiresAt?: number;
  }
}
