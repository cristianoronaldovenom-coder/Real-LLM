# ─── Stage 1: Build client ─────────────────────────────────────────────────
FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ─── Stage 2: Build server ─────────────────────────────────────────────────
FROM node:22-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ─── Stage 3: Production image ─────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Production server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Built artifacts
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=client-builder /app/client/dist  ./client/dist

# Entrypoint (runs migrations then starts the server)
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/docker-entrypoint.sh"]
