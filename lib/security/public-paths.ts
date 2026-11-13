/**
 * Auth.js `proxy.ts` must not bounce these to /login. Probes, join, and
 * Auth.js itself have to work without a session cookie.
 */
export function isUnauthenticatedPath(pathname: string): boolean {
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/invite/")) return true;
  if (pathname === "/join" || pathname.startsWith("/join/")) return true;
  if (pathname === "/api/join") return true;
  if (pathname === "/brand" || pathname.startsWith("/brand/")) return true;
  if (pathname === "/api/health") return true;
  return false;
}

/** Guest activity-session lock still allows these hops. */
export function isActivityLockExemptPath(pathname: string): boolean {
  if (isUnauthenticatedPath(pathname)) return true;
  if (pathname.startsWith("/api/media/") || pathname.startsWith("/media/")) {
    return true;
  }
  if (pathname === "/api/invites/claim") return true;
  return false;
}
