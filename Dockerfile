FROM node:18-alpine
# Create app directory
WORKDIR /usr/src/app

# Install mqtt-broker
RUN apk --no-cache add mosquitto

# Install nodered
RUN npm install -g --unsafe-perm node-red
RUN cd /usr/local/lib/node_modules/node-red && npm install node-red-dashboard node-red-mongodb

# Install Tas
# where available (npm@5+)
COPY package*.json ./

RUN npm install --only=production
# If you are building your code for production
# RUN npm ci --only=production
# Bundle app source
COPY . .
# Install supervisord
RUN apk --no-cache add supervisor

# Copy supervisord.conf file
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose ports for Mosquitto and Node-RED
EXPOSE 1883 1880 3004

# Start supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
