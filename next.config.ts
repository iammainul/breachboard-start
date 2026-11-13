import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./lib/security/headers";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  // @cursor/sdk ships chunked ESM + adjacent *.js.LICENSE.txt files that Turbopack
  // cannot load as modules. Keep it Node-external (API route only).
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "pino",
    "@cursor/sdk",
    "@cursor/sdk-linux-x64",
    "@cursor/sdk-linux-arm64",
    "@cursor/sdk-darwin-arm64",
    "@cursor/sdk-darwin-x64",
    "@cursor/sdk-win32-x64",
    "exceljs",
    "pdfjs-dist",
    "mammoth",
  ],
  experimental: {
    optimizePackageImports: ["@ai-sdk/openai", "@ai-sdk/anthropic", "@ai-sdk/google", "zod"],
  },
  // Proxy must see `rsc` / `next-router-*` / `_rsc`. Default normalize strips
  // them, and cloning that view into NextResponse.next({ request }) made hub →
  // session client navigations 307 into ?_rsc=. See docs/decisions/e2e.md.
  skipProxyUrlNormalize: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Runtime uploads live on MEDIA_ROOT (often a volume). Trace the default
  // data/media tree so standalone output does not warn on dynamic fs paths.
  outputFileTracingIncludes: {
    "/api/media/**": ["./data/media/**/*"],
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Runtime files live under MEDIA_ROOT (often outside public/). Browser
  // /media/* URLs go through the authenticated file route. beforeFiles so a
  // leftover public/media copy cannot bypass authz.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/media/:path*", destination: "/api/media/:path*" },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: STATIC_SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
