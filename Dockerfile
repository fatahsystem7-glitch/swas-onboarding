# ─────────────────────────────────────────────────────────────
# SwaS Onboarding & Telephony Engine — production image
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source.
COPY . .

# Drop root for runtime.
USER node

EXPOSE 3000

# Basic container healthcheck hitting the app's /health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Run migrations, then boot the server.
CMD ["sh", "-c", "npm run migrate && npm start"]
