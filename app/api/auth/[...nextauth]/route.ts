import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/security/api-guard";
import {
  authPostLimitKind,
  normalizeLoginAccount,
  peekCredentialField,
} from "@/lib/security/auth-rate-limit";

export const { GET } = handlers;

export async function POST(request: NextRequest) {
  const kind = authPostLimitKind(request.nextUrl.pathname);
  if (kind === "login") {
    const email = await peekCredentialField(request, "email");
    const limited = enforceRateLimit(
      request,
      "login",
      normalizeLoginAccount(email),
    );
    if (limited) return limited;
  } else if (kind === "invite") {
    const limited = enforceRateLimit(request, "invite");
    if (limited) return limited;
  }
  return handlers.POST(request);
}
