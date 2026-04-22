# ── Stage 1: build ──────────────────────────────────────────────
FROM node:25-alpine AS builder
WORKDIR /app

# Copy manifests first for better layer caching
COPY package*.json nest-cli.json tsconfig.json ./

# Install dependencies with lockfile if available
RUN npm install --loglevel=error

# Copy source and build
COPY src ./src
RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────
FROM node:25-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy manifests and node_modules from builder
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Prune dev dependencies in-place
RUN npm prune --omit=dev

# Switch to non-root user
USER nodejs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD ps aux | grep -E "[n]ode.*dist/main" || exit 1

CMD ["node", "dist/main"]
