/**
 * Same-origin mutation guard. Browsers send Origin on cross-site POST;
 * Playwright APIRequestContext and curl often send neither Origin nor Referer.
 *
 * Policy: if Origin or Referer is present, the host must match this app.
 * If both are absent, allow (non-browser / SameSite=Lax already blocks
 * cookie'd cross-site POST from modern browsers).
 */

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function allowedMutationHosts(requestUrl: string, authUrl?: string | null) {
  const hosts = new Set<string>();
  const reqHost = hostOf(requestUrl);
  if (reqHost) hosts.add(reqHost);
  const configured = hostOf(authUrl ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL);
  if (configured) hosts.add(configured);
  return hosts;
}

export function isSameOriginMutation(
  request: {
    url: string;
    headers: { get(name: string): string | null };
  },
  authUrl?: string | null,
): boolean {
  const allowed = allowedMutationHosts(request.url, authUrl);
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const secFetchSite = (request.headers.get("sec-fetch-site") ?? "").toLowerCase();

  if (secFetchSite === "same-origin" || secFetchSite === "none") return true;
  if (secFetchSite === "cross-site") return false;

  if (origin === "null") return false;
  const originHost = hostOf(origin);
  if (originHost) return allowed.has(originHost);

  const refererHost = hostOf(referer);
  if (refererHost) return allowed.has(refererHost);

  return true;
}

export function csrfDenied(request: {
  url: string;
  method: string;
  headers: { get(name: string): string | null };
}): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  return !isSameOriginMutation(request);
}
