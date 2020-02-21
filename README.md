# Test and Simulation

Test and Simulation enabler

## Setup

### Node-RED

```
sudo npm install -g --unsafe-perm node-red
```
Additional packets: `node-red-mongodb`, `node-red-contrib-web-worldmap`, `node-red-dashboard`

## External Service

There are some external services which is provided as docker container.

### docker useful commands

```
docker ps
docker ps -a
docker start container-name
docker stop container-name
docker attach container-name
```

### MQTT broker server

Start a MQTT broker server
```
docker run --name mqtt-broker -d -p 1882:1883 luongnv89/mosquitto-mqtt-broker
```

### MongoDB server

Start a Mongodb server
```
docker run --name mongo-server -d -p 27017:27017 mongo
```

### MQTT client interface

Start a MQTT client interface
```
docker run --rm -it luongnv89/mosquitto-cli /bin/sh
```

Subscribe a channel
```
mosquitto_sub --host 192.168.0.11 --port 1882 -t "#"
```

Publish a message
```
mosquitto_pub --host 192.168.0.11 --port 1882 -t "ext-01-sub-topic" -m "Hello World"
```

## NOTES
- In the configuration of gateways and things, if the thing with id `t01` scales `2` times, then the configuration of the thing `t01` in the gateway should scale `2` times as well, so that they will automatically adapt
- In the configuration of gateway, the upstreams section, the value of `out` is an array because the upstreams can be multiple different service
- The gateway cannot be scaled, because the id does not effect to the functionality of the gateway -> other way to say, if two gateways are only difficiated by their ids, their functionalities are exactly the same.
- The external component in the gateway is not scalable (same explaination with the gateway)