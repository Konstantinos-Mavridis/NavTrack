# ── Stage 1: build ──────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json nest-cli.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# ── Stage 2: runtime ────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Copy the lock file generated during the build stage so npm ci works
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Prune dev dependencies in-place (faster than re-installing)
RUN npm prune --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/portfolios || exit 1

CMD ["node", "dist/main"]
