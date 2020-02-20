# Test and Simulation

Test and Simulation enabler

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