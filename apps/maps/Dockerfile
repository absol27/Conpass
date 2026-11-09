# Built from the repo root: docker build -f apps/maps/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY apps/maps/package.json apps/maps/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/maps/ .
RUN npm run build:server

FROM node:22-alpine
WORKDIR /app
# Runtime deps: OpenTelemetry zero-code instrumentation (loaded via NODE_OPTIONS in deploy/maps.yaml).
COPY apps/maps/package.json apps/maps/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY apps/maps/otel.mjs ./otel.mjs
# Floor-plan images for the map in apps/web.
COPY --from=build /app/public ./public
COPY --from=build /app/server-dist ./server-dist
ARG APP_VERSION=dev
ENV NODE_ENV=production PORT=8080 APP_VERSION=$APP_VERSION
# The node image's "node" user, by number so runAsNonRoot can check it.
USER 1000
EXPOSE 8080
CMD ["node", "server-dist/main.mjs"]
