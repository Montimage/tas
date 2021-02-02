# Test and Simulation

Test and Simulation enabler

## Use docker image

Refer: `https://hub.docker.com/r/montimage/iot_test_and_simulation`

```
docker run --name tas -d -p 8080:31057 montimage/iot_test_and_simulation
```

Then access to the tool at the address: `http://[your_ip_address]:8080`

## Setup

```
cd test_and_simulation/
npm install
```

## Usage

### Start application
```
npm run start
```
Access to the Test and Simulation Enabler dashboard at: `http://your_ip:31057`

_Customize dashboard address_

Create `.env` file: `cp env.example .env`
Update the `host` and `port` then start the application.

### Start application with `forever`
Install `forever`

```
npm install forever -g
```

Start Test and Simulation
```
npm run forever-start
```

Stop Test and Simulation
```
npm run forever-stop
```

## DEVELOPMENT

### Create docker image for multiple platform
Source: https://www.docker.com/blog/multi-arch-images/
- Enable `buildx`:
- Create new build engine:
```
docker buildx create --name mybuilder
docker buildx use mybuilder
docker buildx inspect --bootstrap
```
- Build a new image for multiple platform
```
docker buildx build --platform linux/amd64,linux/arm64 -t enactproject/iot_test_and_simulation:latest --push .
```

### Create docker image

Create docker image

```
docker build -t enact/tas .
```
Create container

```
docker run --name tas -d -p 9112:31057 enact/tas
```
-> Go to : http://your_ip:9112

Customize the environment by creating your own .env file
```
docker run --name tas -d -p 8080:8080 -v [absolute-path-to-env-file]:/enact/.env enact/tas
```
-> Go to : http://your_ip:8080

Ref: https://nodejs.org/de/docs/guides/nodejs-docker-webapp/

### Data Generator
Generate data (sensors and actuators) and store the data into a database
Update the configuration `data-01.json` file
```
cd src/data-generators/
node index.js test data-01.json
```

### Simulate Gateway(s)
Simulate gateway(s) with the input configuration file: `gw-config.json`
```
cd src/gateways/
node index.js gw-config.json
```

### Simulate Thing(s)
Simulate thing(s) with the input configuration file: `thing-config.json`
A THING can contain list of sensor(s) and actuator(s)
```
cd src/things/
node index.js test thing-config.json
```

## Use Cases

### Light Controller

![Light Controller](light-controller.png)

## External Components
Some external services may required such as: `mongodb-server`, `mqtt-broker`, `node-red`
The services can be provided as docker containers.

### Node-RED

```shell
sudo npm install -g --unsafe-perm node-red
```
Additional packets: `node-red-mongodb`, `node-red-contrib-message-counter`, `node-red-dashboard`

### MongoDB server

Start a Mongodb server
```shell
docker run --name mongo-server -d -p 27017:27017 mongo
```

### MQTT broker server

Start a MQTT broker server
```shell
docker run --name mqtt-broker -d -p 1882:1883 luongnv89/mosquitto-mqtt-broker
```

### MQTT client interface

Start a MQTT client interface
```shell
docker run --rm -it luongnv89/mosquitto-cli /bin/sh
```

Subscribe a channel
```shell
mosquitto_sub --host 192.168.0.11 --port 1882 -t "#"
```

Publish a message
```shell
mosquitto_pub --host 192.168.0.11 --port 1882 -t "ext-01-sub-topic" -m "Hello World"
```
### Build docker image

Build a new version
```
npm run build
```
Create docker images
```
docker build -t montimage/iot_test_and_simulation .
```
Update new image to docker hub

```
docker push montimage/iot_test_and_simulation:latest
```

Start a new container

```
docker run --name tas -d -p 8080:31057 montimage/iot_test_and_simulation
```


### docker useful commands

```shell
docker ps
docker ps -a
docker start container-name
docker stop container-name
docker attach container-name
```

## Discussion
- In the configuration of gateways and things, if the thing with id `t01` scales `2` times, then the configuration of the thing `t01` in the gateway should scale `2` times as well, so that they will automatically adapt
- In the configuration of gateway, the upstreams section, the value of `out` is an array because the upstreams can be multiple different service
- The gateway cannot be scaled, because the id does not effect to the functionality of the gateway -> other way to say, if two gateways are only difficiated by their ids, their functionalities are exactly the same.
- The external component in the gateway is not scalable (same explaination with the gateway)