/**
 * Next.js App Router client navigations are RSC "flights", not documents.
 * Default proxy URL normalize strips `rsc` / `next-router-*` / `_rsc` before
 * `proxy.ts` runs. Cloning that view into `NextResponse.next({ request })`
 * drops Flight headers on the real request; `validateRSCRequestHeaders` then
 * 307s to `?_rsc=`, and Chromium aborts the follow as a document.
 *
 * Requires `skipProxyUrlNormalize: true` so these headers are visible.
 * See docs/decisions/e2e.md.
 */
export function isRscNavigationRequest(headers: Headers): boolean {
  if (headers.get("rsc") === "1") return true;
  if (headers.has("next-router-prefetch")) return true;
  if (headers.has("next-router-state-tree")) return true;
  if (headers.has("next-router-segment-prefetch")) return true;
  if (headers.has("next-hmr-refresh")) return true;
  return false;
}
