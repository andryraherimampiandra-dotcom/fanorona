# Fanorona single-service image: serves the Expo web build + the WebSocket game
# server on the same HTTPS port. Designed to run on Fly.io, Railway, Render,
# Cloud Run, or any PaaS that exposes $PORT.
#
# Build in two stages so Expo's build toolchain doesn't end up in the runtime.

FROM node:22-alpine AS builder
WORKDIR /app

# Copy manifests first for cache friendliness.
COPY package.json README.md LICENSE ./
COPY packages/engine/package.json packages/engine/package-lock.json packages/engine/
COPY packages/ai/package.json packages/ai/package-lock.json packages/ai/
COPY packages/protocol/package.json packages/protocol/package-lock.json packages/protocol/
COPY packages/server/package.json packages/server/package-lock.json packages/server/
COPY apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/

# Install per-package (we're not using npm workspaces — see README).
RUN cd packages/engine && npm ci --omit=dev --no-audit --no-fund || npm install --no-audit --no-fund
RUN cd packages/protocol && npm install --no-audit --no-fund
RUN cd packages/ai && npm install --no-audit --no-fund
RUN cd packages/server && npm install --no-audit --no-fund
RUN cd apps/mobile && npm install --no-audit --no-fund

# Copy the full source.
COPY packages ./packages
COPY apps ./apps

# Build the Expo web bundle into apps/mobile/dist.
ARG FANORONA_SERVER_URL=""
ENV FANORONA_SERVER_URL=${FANORONA_SERVER_URL}
RUN cd apps/mobile && npx expo export --platform web --output-dir dist

# ---- Runtime image -----------------------------------------------------------
FROM node:22-alpine
WORKDIR /app

# Copy only what the server needs at runtime.
COPY --from=builder /app/packages/engine ./packages/engine
COPY --from=builder /app/packages/protocol ./packages/protocol
COPY --from=builder /app/packages/ai ./packages/ai
COPY --from=builder /app/packages/server ./packages/server
# The static web build is served from /app/packages/server/public.
COPY --from=builder /app/apps/mobile/dist ./packages/server/public

WORKDIR /app/packages/server
ENV PORT=8787
EXPOSE 8787
# The server reads ./public as static root when the env var is set, else when
# ./public exists next to cwd. Either way this serves the web app + /ws.
CMD ["npx", "tsx", "src/server.ts"]
