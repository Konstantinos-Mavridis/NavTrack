# ── Stage 1: build ────────────────────────────────────────────────────────────────────
FROM node:25-alpine AS builder
WORKDIR /app

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy manifests first for better layer caching
COPY package*.json ./
RUN npm install --loglevel=error

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────────────
FROM nginx:1.30.0-alpine AS runtime

# Create cache/log/run directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run/nginx && \
    chmod 755 /var/cache/nginx /var/log/nginx /var/run/nginx

# Create non-root user for security
RUN addgroup -g 1001 -S nginx-user && adduser -S nginx-user -u 1001

# Copy custom nginx main config and server config
COPY nginx.conf.main /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built artifacts from builder
COPY --from=builder --chown=nginx-user:nginx-user /app/dist /usr/share/nginx/html

# Set ownership of nginx directories and logs to non-root user
RUN chown -R nginx-user:nginx-user /var/cache/nginx /var/log/nginx /var/run/nginx /etc/nginx/conf.d

# Switch to non-root user
USER nginx-user

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
