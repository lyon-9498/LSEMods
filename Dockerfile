# LSEmods — production image (Next.js standalone), reachable on LAN for phone QA
# Pin base image digest (CIS / supply-chain).
FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat \
  && apk upgrade --no-cache
COPY package.json package-lock.json ./
# Lockfile install without lifecycle scripts (supply-chain hardening).
RUN npm ci --ignore-scripts

FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
# Rebuild native/optional binaries that skipped postinstall in deps.
RUN npm rebuild
COPY . .
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build \
  # Drop source maps from the standalone server bundle (sensitive-data exposure).
  && find .next -name '*.map' -type f -delete

FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS runner
WORKDIR /app
RUN apk upgrade --no-cache
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/courses" >/dev/null || exit 1

CMD ["node", "server.js"]
