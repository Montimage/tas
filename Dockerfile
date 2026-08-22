# The application image (issue #45): TaS and nothing but TaS.
#
# The MQTT broker and the Node-RED flow editor are separate images wired
# together by docker-compose.yml, so this image carries only the application
# and its own dependencies. The single-container image that supervised all
# three under supervisord is gone; see README.md ("Migrating from the
# single-container deployment") for the upgrade path.
FROM node:22-alpine

WORKDIR /usr/src/app

# Install TaS production dependencies from the committed lockfile
COPY package*.json ./
RUN npm ci --omit=dev

# Bundle app source
COPY . .

# Build the dashboard client (issue #42: the compiled bundle is no longer
# committed, so it is produced here from src/client/ and emitted to src/public,
# which the server serves). This keeps the deployed UI in lock-step with the
# client source instead of a drifted committed artefact.
RUN cd src/client && npm install && npm run build \
    && echo 'Built dashboard client into src/public'

# Prepare runtime-writable locations for the unprivileged user
RUN mkdir -p src/server/logs/data-recorders src/server/logs/simulations src/server/logs/test-campaigns src/server/reports \
    && chown -R node:node /usr/src/app

# Production mode exactly as `npm start` sets it (issue #76)
ENV NODE_ENV=production

USER node

EXPOSE 3004

# The same readiness probe the composition declares (issue #45): startup is
# complete when /api/health answers.
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
  CMD wget -q -O- "http://127.0.0.1:${SERVER_PORT:-3004}/api/health" >/dev/null 2>&1 || exit 1

CMD ["node", "src/server/app.js"]
