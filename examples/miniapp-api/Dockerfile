# syntax=docker.io/docker/dockerfile:1

FROM node:24-bookworm-slim AS builder

ENV CI=true
WORKDIR /workspace

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@11.5.1 --activate

COPY . .

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
# Filesystem tracing used by the task cache is unsupported under some cross-architecture builders.
RUN ./node_modules/.bin/vp run --no-cache -t @example/miniapp-api#build
RUN pnpm --config.inject-workspace-packages=true \
    --filter @example/miniapp-api deploy --prod /opt/miniapp-api
RUN cp -R examples/miniapp-api/dist /opt/miniapp-api/dist
# Node 24 runs the standalone initializer with native TypeScript support.
RUN mkdir -p /opt/miniapp-api/scripts /opt/miniapp-api/src/lib/services/object-storage \
    && cp examples/miniapp-api/scripts/init-object-storage.ts /opt/miniapp-api/scripts/ \
    && cp examples/miniapp-api/src/lib/services/object-storage/config.ts \
          examples/miniapp-api/src/lib/services/object-storage/initialization.ts /opt/miniapp-api/src/lib/services/object-storage/

FROM node:24-bookworm-slim AS runner

ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV PORT=9999

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder --chown=node:node /opt/miniapp-api ./

USER node
EXPOSE 9999

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:9999/api/health >/dev/null || exit 1

CMD ["node", "dist/index.js"]
