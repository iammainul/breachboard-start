import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { logSecurityEvent } from "@/lib/logger";
import { csrfDenied } from "@/lib/security/csrf";
import { applySecurityHeaders, requestIsHttps } from "@/lib/security/headers";
import {
  isActivityLockExemptPath,
  isUnauthenticatedPath,
} from "@/lib/security/public-paths";
import { isRscNavigationRequest } from "@/lib/security/rsc-request";

function newNonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

function withSecurity(
  response: NextResponse,
  nonce: string,
  isDev: boolean,
  https: boolean,
) {
  applySecurityHeaders(response.headers, nonce, isDev, https);
  return response;
}

export const proxy = auth((req) => {
  const nonce = newNonce();
  const isDev = process.env.NODE_ENV === "development";
  const https = requestIsHttps({
    headers: req.headers,
    protocol: req.nextUrl.protocol,
  });
  // skipProxyUrlNormalize: Flight headers are visible here. Do not clone them
  // onto NextResponse.next({ request }) for RSC — that duplicates the router
  // state tree and, without the flag, replaced the real Flight headers with
  // the stripped view so validateRSCRequestHeaders 307'd to ?_rsc=.
  const isRsc = isRscNavigationRequest(req.headers);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  if (csrfDenied(req)) {
    logSecurityEvent("csrf_denied", { code: "CSRF", route: "proxy", status: 403 });
    const denied = NextResponse.json(
      { error: "Forbidden", code: "CSRF" },
      { status: 403 },
    );
    return withSecurity(denied, nonce, isDev, https);
  }

  const { pathname } = req.nextUrl;
  const isLogin = pathname.startsWith("/login");
  const publicPath = isUnauthenticatedPath(pathname);
  const authed = Boolean(req.auth?.user?.id);
  const activitySessionId = req.auth?.user?.activitySessionId;
  const activityExpiresAt = req.auth?.user?.activityExpiresAt;
  const activityExpired = Boolean(
    activityExpiresAt && activityExpiresAt <= Date.now(),
  );

  const next = () =>
    withSecurity(
      isRsc
        ? NextResponse.next()
        : NextResponse.next({ request: { headers: requestHeaders } }),
      nonce,
      isDev,
      https,
    );

  const redirectTo = (path: string, search?: Record<string, string>) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    // Never bounce a flight onto ?_rsc= — Next follows that as RSC, Chromium
    // may then load it as a document. Login / activity-lock hops are pages.
    url.search = "";
    url.hash = "";
    if (search) {
      for (const [key, value] of Object.entries(search)) {
        url.searchParams.set(key, value);
      }
    }
    return withSecurity(NextResponse.redirect(url), nonce, isDev, https);
  };

  if ((!authed || activityExpired) && !publicPath) {
    return redirectTo("/login", {
      callbackUrl: pathname,
      ...(activityExpired ? { expired: "1" } : {}),
    });
  }

  if (authed && !activityExpired && isLogin) {
    return redirectTo(
      activitySessionId ? `/sessions/${activitySessionId}` : "/",
    );
  }

  if (
    authed &&
    !activityExpired &&
    activitySessionId &&
    !isActivityLockExemptPath(pathname)
  ) {
    const permitted =
      pathname.startsWith(`/sessions/${activitySessionId}`) ||
      pathname.startsWith(`/api/sessions/${activitySessionId}`);
    if (!permitted) {
      return redirectTo(`/sessions/${activitySessionId}`);
    }
  }

  return next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|media/|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
