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
RUN ./node_modules/.bin/vp run -t @app/template-api#build
RUN pnpm --config.inject-workspace-packages=true \
    --filter @app/template-api deploy --prod /opt/template-api
RUN cp -R apps/template-api/dist /opt/template-api/dist

FROM node:24-bookworm-slim AS runner

ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV PORT=9999

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder --chown=node:node /opt/template-api ./

USER node
EXPOSE 9999

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:9999/api/health >/dev/null || exit 1

CMD ["node", "dist/index.js"]
