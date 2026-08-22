# ClearSet AI — Snowpark Container Services (SPCS) image
#
# Pre-built strategy: React (dist/) and TypeScript (server/dist/) are compiled
# locally before docker build. This avoids platform-specific devDependency
# conflicts (e.g. oxlint win32 binding) that fail during Linux container builds.
#
# Before running docker build, ensure both are current:
#   npm run build              (Vite — produces dist/)
#   npm run build --prefix server  (tsc — produces server/dist/)

FROM node:22-alpine

WORKDIR /app

# Install production server dependencies only — no devDependencies, no native
# build tools needed since TypeScript is already compiled.
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server --omit=dev

# Copy pre-built backend (TypeScript already compiled to JS)
COPY server/dist ./server/dist

# Copy pre-built frontend (Vite already produced static assets)
COPY dist ./dist

# SPCS injects PORT, SNOWFLAKE_HOST, SNOWFLAKE_ACCOUNT, and writes the
# OAuth token to /snowflake/session/token automatically at runtime.
# No passwords or PATs are configured here.
ENV PORT=8080

EXPOSE 8080

# Health check — SPCS readiness probe hits this endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "server/dist/index.js"]
