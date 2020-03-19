# For testing some Dockerfile commands

# Based on Ubuntu:latest
FROM ubuntu:18.04

# Update system
RUN apt-get update -y

# Install github - code version control
RUN apt-get install -y git

# Install wget - downloader for Unix terminal
RUN apt-get install -y curl

# Install curl - downloader for Unix terminal
RUN apt update -y

# INSTALL NODEJS + NPM

RUN curl -sL https://deb.nodesource.com/setup_13.x -o nodesource_setup.sh
RUN bash nodesource_setup.sh
RUN apt-get install -y nodejs

# Set workspace - where to start working
WORKDIR /enact/

RUN git clone https://gitlab.com/enact/test_and_simulation.git .
RUN npm install --only=production

CMD [ "node", "src/dashboard/server/app.js"]