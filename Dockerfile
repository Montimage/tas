FROM node:22-alpine
# Create app directory
WORKDIR /usr/src/app

# Install mosquitto and supervisor
RUN apk --no-cache add mosquitto supervisor
RUN echo 'Installed mosquitto and supervisor'
# Install nodered
RUN npm install -g --unsafe-perm node-red
RUN cd /usr/local/lib/node_modules/node-red && npm install node-red-dashboard node-red-mongodb
RUN echo 'Installed nodered'
# Install Tas production dependencies from the committed lockfile
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

# Copy supervisord.conf file
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Ship the committed broker policy in place of the distribution default
# (issue #46): the access policy is stated in the repository, not inherited.
COPY mosquitto.conf /etc/mosquitto/mosquitto.conf

# Prepare runtime-writable locations for the unprivileged user
# (/run/mosquitto is where an operator mounts the broker password file).
RUN mkdir -p /var/lib/mosquitto /run/mosquitto /var/log \
    src/server/logs/data-recorders src/server/logs/simulations src/server/logs/test-campaigns src/server/reports \
    && chown -R node:node /usr/src/app /var/lib/mosquitto /run/mosquitto /var/log
# Run every supervised process as an unprivileged user
USER node

# Expose ports for Mosquitto and Node-RED
EXPOSE 1883 1880 3004
RUN echo 'Ready to launch'
# Start supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
