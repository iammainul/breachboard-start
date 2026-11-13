import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { claimPasswordlessInvite } from "@/lib/claim-role-invite";
import { verifyGuestJoinToken } from "@/lib/guest-join-token";
import { allowInviteClaim } from "@/lib/invite-rate-limit";
import { bumpAuthEpoch, epochsMatch, readAuthEpoch } from "@/lib/auth-session";
import { verifyTotp } from "@/lib/totp";

class TotpRequiredError extends CredentialsSignin {
  code = "totp_required";
}

const useSecureCookies =
  process.env.AUTH_URL?.startsWith("https://") ||
  process.env.NEXTAUTH_URL?.startsWith("https://") ||
  process.env.NODE_ENV === "production";

const sessionCookieName = useSecureCookies
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  useSecureCookies, // @auth/core AuthConfig — Secure cookies on https / production
  cookies: {
    sessionToken: {
      name: sessionCookieName,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: useSecureCookies
        ? "__Host-authjs.csrf-token"
        : "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: useSecureCookies
        ? "__Secure-authjs.callback-url"
        : "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "Authenticator code", type: "text" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const envEmail = process.env.OPERATOR_EMAIL?.trim().toLowerCase();
        const envPassword = process.env.OPERATOR_PASSWORD ?? "";

        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          const count = await prisma.user.count();
          if (
            count === 0 &&
            envEmail &&
            envPassword &&
            email === envEmail &&
            password === envPassword
          ) {
            user = await prisma.user.create({
              data: {
                email,
                name: "Admin",
                passwordHash: await hashPassword(password),
                platformRole: "ADMIN",
                canFacilitate: true,
              },
            });
          } else {
            return null;
          }
        }

        if (!user.passwordHash) {
          if (
            envEmail &&
            envPassword &&
            email === envEmail &&
            password === envPassword
          ) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                passwordHash: await hashPassword(password),
                platformRole: "ADMIN",
                canFacilitate: true,
                name: user.name || "Admin",
              },
            });
          } else {
            return null;
          }
        }

        if (!user.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        if (user.totpEnabled) {
          const totp = String(credentials?.totp ?? "").trim();
          if (!totp) throw new TotpRequiredError();
          if (!user.totpSecret || !verifyTotp(user.totpSecret, totp)) return null;
        }

        const authEpoch = await bumpAuthEpoch(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          platformRole: user.platformRole,
          organizationId: user.organizationId,
          authEpoch,
        };
      },
    }),
    Credentials({
      id: "invite-token",
      name: "Activity invitation",
      credentials: {
        token: { label: "Invitation token", type: "password" },
      },
      authorize: async (credentials, request) => {
        const token = String(credentials?.token ?? "");
        const forwarded = request.headers.get("x-forwarded-for") ?? "";
        const clientKey = forwarded.split(",")[0]?.trim() || "unknown";
        if (!allowInviteClaim(clientKey)) return null;
        const claim = await claimPasswordlessInvite(token);
        if (!claim.ok) return null;
        const authEpoch = await bumpAuthEpoch(claim.user.id);
        return {
          ...claim.user,
          activitySessionId: claim.sessionId,
          activityExpiresAt: claim.activityExpiresAt,
          authEpoch,
        };
      },
    }),
    Credentials({
      id: "guest-join",
      name: "Guest join",
      credentials: {
        token: { label: "Guest token", type: "password" },
      },
      authorize: async (credentials) => {
        const token = String(credentials?.token ?? "");
        const verified = verifyGuestJoinToken(token);
        if (!verified) return null;
        const user = await prisma.user.findUnique({
          where: { id: verified.userId },
        });
        if (!user || user.passwordHash) return null;
        const seat = await prisma.sessionSeat.findUnique({
          where: {
            sessionId_userId: {
              sessionId: verified.sessionId,
              userId: user.id,
            },
          },
        });
        if (!seat) return null;
        const authEpoch = await bumpAuthEpoch(user.id);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          platformRole: user.platformRole,
          organizationId: user.organizationId,
          activitySessionId: verified.sessionId,
          activityExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
          authEpoch,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.platformRole =
          "platformRole" in user ? String(user.platformRole) : "USER";
        token.organizationId =
          "organizationId" in user
            ? ((user.organizationId as string | null) ?? null)
            : null;
        token.authEpoch =
          "authEpoch" in user && typeof user.authEpoch === "number"
            ? user.authEpoch
            : 0;
        if ("activitySessionId" in user && user.activitySessionId) {
          token.activitySessionId = String(user.activitySessionId);
          token.activityExpiresAt = Number(user.activityExpiresAt);
        } else {
          delete token.activitySessionId;
          delete token.activityExpiresAt;
        }
        delete token.sessionRevoked;
        return token;
      }

      if (token.sub) {
        const dbEpoch = await readAuthEpoch(token.sub);
        if (!epochsMatch(token.authEpoch, dbEpoch)) {
          return {
            ...token,
            sessionRevoked: true,
            activitySessionId: undefined,
            activityExpiresAt: undefined,
          };
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.sessionRevoked) {
        // Force clients / proxy to treat as logged out.
        return { ...session, user: undefined as never, expires: new Date(0).toISOString() };
      }
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.platformRole = String(token.platformRole ?? "USER");
        session.user.organizationId =
          (token.organizationId as string | null | undefined) ?? null;
        session.user.authEpoch =
          typeof token.authEpoch === "number" ? token.authEpoch : 0;
        session.user.activitySessionId =
          typeof token.activitySessionId === "string"
            ? token.activitySessionId
            : undefined;
        session.user.activityExpiresAt =
          typeof token.activityExpiresAt === "number"
            ? token.activityExpiresAt
            : undefined;
      }
      return session;
    },
  },
});
