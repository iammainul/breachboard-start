import { NextResponse } from "next/server";
import { logSecurityEvent } from "@/lib/logger";
import { clientIp } from "@/lib/security/client-ip";
import { csrfDenied } from "@/lib/security/csrf";
import {
  hitRateLimit,
  type RateLimitBucket,
} from "@/lib/security/rate-limit";

export function csrfErrorResponse() {
  return NextResponse.json(
    { error: "Forbidden", code: "CSRF" },
    { status: 403 },
  );
}

export function rateLimitResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly.", code: "RATE_LIMIT" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

export function denyCrossSiteMutation(request: Request) {
  if (csrfDenied(request)) {
    logSecurityEvent("csrf_denied", { code: "CSRF", status: 403 });
    return csrfErrorResponse();
  }
  return null;
}

export function enforceRateLimit(
  request: Request,
  bucket: RateLimitBucket,
  extraKey?: string,
) {
  const subject = extraKey
    ? `${clientIp(request)}:${extraKey}`
    : clientIp(request);
  const result = hitRateLimit(bucket, subject);
  if (!result.ok) {
    logSecurityEvent("rate_limit", { code: "RATE_LIMIT", bucket, status: 429 });
    return rateLimitResponse(result.retryAfterSec);
  }
  return null;
}

/** CSRF + optional rate limit for mutating route handlers. */
export function prepareMutation(
  request: Request,
  opts?: { rateLimit?: RateLimitBucket; extraKey?: string },
) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  if (opts?.rateLimit) {
    return enforceRateLimit(request, opts.rateLimit, opts.extraKey);
  }
  return null;
}
