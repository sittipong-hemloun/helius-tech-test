# syntax=docker/dockerfile:1.7
# Employee Console API — multi-stage production image (PRD §14.2 "Images").
# No .env is copied; configuration comes from the environment at runtime.
ARG NODE_IMAGE=node:24.21.0-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/api-client/package.json packages/api-client/
COPY tests/e2e/package.json tests/e2e/

FROM base AS build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --filter @employee-console/api...
COPY apps/api apps/api
RUN pnpm --filter @employee-console/api run build \
 && pnpm --filter @employee-console/api exec tsc -p tsconfig.scripts.json --outDir dist-scripts

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prod --filter @employee-console/api...

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 TZ=UTC
# OpenSSL for the Prisma schema engine used by `prisma migrate deploy`.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/package.json /repo/apps/api/prisma.config.ts ./apps/api/
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/dist-scripts ./apps/api/dist-scripts
ARG BUILD_COMMIT_SHA=unknown
ARG APP_VERSION=1.0.0
ENV BUILD_COMMIT_SHA=${BUILD_COMMIT_SHA} APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.title="employee-console-api" org.opencontainers.image.revision="${BUILD_COMMIT_SHA}"
WORKDIR /repo/apps/api
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
STOPSIGNAL SIGTERM
CMD ["node", "dist/main.js"]
