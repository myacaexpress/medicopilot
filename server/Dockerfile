# MediCopilot server — production image
# Single-stage, Node 22 alpine, ~80 MB.

FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies separately from source for layer caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy source + data
COPY src ./src
COPY data ./data

# Fly.io passes PORT via env. Default 8080 matches fly.toml.
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Drop privileges
USER node

CMD ["node", "src/index.js"]
