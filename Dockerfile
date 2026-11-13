FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV AUTH_SECRET=build-time-secret
ENV DATABASE_URL=postgresql://ttx:ttx@db:5432/ttx
ENV ALLOW_DEV_DEFAULTS=true
RUN npx prisma generate
RUN mkdir -p docker \
  && npx esbuild scripts/seed-attack-min.ts --bundle --platform=node --format=cjs --outfile=docker/seed.cjs --external:@prisma/client --alias:@=. \
  && npx esbuild scripts/seed-library.ts --bundle --platform=node --format=cjs --outfile=docker/library-seed.cjs --external:@prisma/client --alias:@=. \
  && npx esbuild scripts/seed-demo.ts --bundle --platform=node --format=cjs --outfile=docker/demo-seed.cjs --external:@prisma/client --alias:@=. \
  && npx esbuild docker/bootstrap.ts --bundle --platform=node --format=cjs --outfile=docker/bootstrap.cjs --external:@prisma/client --alias:@=.
RUN npm run build

# Prisma CLI + its runtime deps (effect, @prisma/config, …) — not the full app tree.
FROM base AS prisma-cli
WORKDIR /tools
RUN --mount=type=cache,target=/root/.npm \
  npm init -y >/dev/null \
  && npm install prisma@6.16.3 --omit=dev --no-fund --no-audit

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/docker/seed.cjs ./docker/seed.cjs
COPY --from=builder --chown=nextjs:nodejs /app/docker/library-seed.cjs ./docker/library-seed.cjs
COPY --from=builder --chown=nextjs:nodejs /app/docker/demo-seed.cjs ./docker/demo-seed.cjs
COPY --from=builder --chown=nextjs:nodejs /app/docker/bootstrap.cjs ./docker/bootstrap.cjs
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=builder /app/package.json ./package.json

# Merge Prisma CLI deps into standalone node_modules (keeps other traced packages).
COPY --from=prisma-cli /tools/node_modules ./node_modules
# Generated client engines from the app build.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

RUN chmod +x ./docker-entrypoint.sh \
  && mkdir -p /data/media \
  && chown -R nextjs:nodejs /app /data/media

ENV MEDIA_ROOT=/data/media

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
