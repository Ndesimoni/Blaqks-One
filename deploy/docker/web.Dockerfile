# syntax=docker/dockerfile:1.7
# Next.js website (apps/website) as a standalone server: one app serves blaqks.one and every
# connected company domain; the Host header picks the site. Built on the target platform
# (emulated when cross-building) so any native optional packages match the runtime.
# Build from the repository root:
#   docker buildx build -f deploy/docker/web.Dockerfile --platform linux/arm64 .
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/website/package.json apps/website/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci --no-audit --no-fund
COPY apps/website/ ./
# prebuild regenerates the approved reference files; NEXT_OUTPUT selects standalone output.
RUN NEXT_OUTPUT=standalone npm run build \
 && test -f .next/standalone/server.js

FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    WEBSITE_DATA_MODE=api
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Cloudflare's Origin CA roots: the server-side fetches reach the public API through this
# server's own gateway, whose certificate Cloudflare issued (docs/hosting.md#tls-trust).
COPY deploy/certs/cloudflare-origin-roots.pem /etc/blaqks/cloudflare-origin-roots.pem
ENV NODE_EXTRA_CA_CERTS=/etc/blaqks/cloudflare-origin-roots.pem
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
LABEL org.opencontainers.image.title="blaqks-web" \
      org.opencontainers.image.description="Blaqks One public websites (Next.js)"
CMD ["node", "server.js"]
