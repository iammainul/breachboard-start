/**
 * Browser security headers. CSP nonce is generated per request in proxy.ts
 * so Next.js can stamp framework scripts. Static fallbacks live in next.config
 * for responses that skip proxy (static assets).
 *
 * HSTS and CSP `upgrade-insecure-requests` are HTTPS-only. Sending them on
 * http://localhost (Playwright, Docker :3080) makes Chromium rewrite the next
 * top-level navigation to https://localhost, which nothing is listening on.
 * See docs/decisions/security.md D3 and docs/decisions/e2e.md.
 */

export function requestIsHttps(input: {
  headers?: Headers;
  protocol?: string;
}): boolean {
  const forwarded = input.headers
    ?.get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  if (forwarded === "https") return true;
  if (forwarded === "http") return false;
  if (input.protocol === "https:" || input.protocol === "https") return true;
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  return authUrl.startsWith("https://");
}

export function cspHeader(nonce: string, isDev: boolean, https = false) {
  const script = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  // Tailwind / React style attributes and Next font CSS. Nonce-only style-src
  // breaks Stage/Present chrome; see docs/decisions/security.md.
  const style = `'self' 'unsafe-inline'`;
  const parts = [
    `default-src 'self'`,
    `script-src ${script}`,
    `style-src ${style}`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `media-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `frame-src 'none'`,
    `worker-src 'self' blob:`,
  ];
  if (https) parts.push("upgrade-insecure-requests");
  return parts.join("; ").replace(/\s{2,}/g, " ").trim();
}

export const HSTS_HEADER = {
  key: "Strict-Transport-Security",
  value: "max-age=31536000; includeSubDomains",
} as const;

/** Headers safe on HTTP and HTTPS. HSTS is applied only when the request is TLS. */
export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

export function applySecurityHeaders(
  headers: Headers,
  nonce?: string,
  isDev = false,
  https = false,
) {
  for (const header of STATIC_SECURITY_HEADERS) {
    headers.set(header.key, header.value);
  }
  if (https) {
    headers.set(HSTS_HEADER.key, HSTS_HEADER.value);
  }
  if (nonce) {
    headers.set("Content-Security-Policy", cspHeader(nonce, isDev, https));
  }
}
