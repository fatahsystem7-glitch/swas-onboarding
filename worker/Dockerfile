# ─────────────────────────────────────────────────────────────
# sitering-receptionist LiveKit voice agent worker
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# Build tooling + Python are needed for onnxruntime-node (Silero VAD) postinstall.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

USER node

# The worker is a long-running process; no exposed port (it dials out to LiveKit).
CMD ["npm", "start"]
