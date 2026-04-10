# ── Stage 1: build ──────────────────────────────────────────────
FROM node:25-alpine AS builder
WORKDIR /app

COPY package*.json nest-cli.json tsconfig.json ./
# Remove the lockfile so npm resolves fresh from package.json,
# applying the overrides block (glob>=13) instead of pinned stale versions.
# --loglevel=error suppresses deprecation warnings from transitive deps
# that cannot be overridden without regenerating the lockfile.
RUN rm -f package-lock.json && npm install --loglevel=error

COPY src ./src
RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────
FROM node:25-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Copy the lock file generated during the build stage so npm ci works
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Prune dev dependencies in-place (faster than re-installing)
RUN npm prune --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/portfolios || exit 1

CMD ["node", "dist/main"]
