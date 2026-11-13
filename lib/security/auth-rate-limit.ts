/**
 * Auth.js POST /api/auth/* is a catch-all. Guest-join and invite callbacks
 * must not consume the login bucket (a NAT classroom would lock the operator
 * out). See docs/decisions/security.md D2 and docs/decisions/e2e.md.
 */

export type AuthPostLimitKind = "login" | "invite" | null;

export function authPostLimitKind(pathname: string): AuthPostLimitKind {
  const parts = pathname.split("/").filter(Boolean);
  const callbackAt = parts.indexOf("callback");
  if (callbackAt < 0) return null;
  const provider = parts[callbackAt + 1] ?? "";
  if (provider === "guest-join") return null;
  if (provider === "invite-token") return "invite";
  if (provider === "credentials") return "login";
  return provider ? "login" : null;
}

export function normalizeLoginAccount(email: string | undefined | null): string {
  const trimmed = email?.trim().toLowerCase() ?? "";
  return trimmed.includes("@") ? trimmed : "unknown";
}

export function normalizeJoinCode(code: string | undefined | null): string {
  const trimmed = code?.trim().toUpperCase() ?? "";
  return trimmed.length >= 4 ? trimmed : "unknown";
}

/** Read one field from a cloned body so Auth.js can still consume the request. */
export async function peekCredentialField(
  request: Request,
  field: string,
): Promise<string | undefined> {
  const clone = request.clone();
  const contentType = clone.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const json = (await clone.json()) as Record<string, unknown>;
      const value = json[field];
      return typeof value === "string" ? value.trim() : undefined;
    }
    const form = await clone.formData();
    const value = form.get(field);
    return typeof value === "string" ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}
