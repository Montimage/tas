# Test and Simulation

Test and Simulation

## Use docker image

> **Security note:** the TaS service has **no built-in authentication**. Any client
> that can reach its network ports can use it. Do not expose it to untrusted
> networks. See the [Security](#security) section before deploying.

For a safe local start, bind the published ports to localhost (loopback only):

```
docker run --name my-tas -d -p 127.0.0.1:1883:1883 -p 127.0.0.1:1880:1880 -p 127.0.0.1:3004:3004 ghcr.io/montimage/tas:v1.0.2
```

Then access to the tool at the address: `http://127.0.0.1:3004`

A MQTT broker server at the address: `127.0.0.1:1883`,
A nodered server at the address: `http://127.0.0.1:1880`, and the nodered dashboard at the address: `http://127.0.0.1:1880/ui`

If you need other hosts on a **trusted private network** to reach the service, replace
`127.0.0.1` with the machine's private interface address. Do not publish these ports to
`0.0.0.0` or to the public internet while the service has no authentication.

## Install from source code

```
cd tas/
npm install
```

### Usage

#### Start application

_Customize dashboard address_

Create `.env` file: `cp env.example .env`
Update the `host` and `port` then start the application.

_Start the application_

```
npm run start
```
Access to the Test and Simulation Enabler dashboard at: `http://your_ip:3004`

## Connect to a MongoDB Server

After starting the application, the Data Storage need to be configured to connect with a MongoDB server

- Open the browser and go to the application at: http://your_ip:3004
- Go to the Tab `Data Storage` and update the parameter for connecting to a MongoDB Server

A MongoDB Server can be set up easily with docker:
```
docker run --name mongo-server -d -p 27017:27017 mongo
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
docker buildx build --platform linux/amd64,linux/arm64 -t image_name:tag --push .
```

## Use Cases

### Temperature Controller

By default, there is a simple example of Temperature Controller
The simple IoT network is figured in the following photo:

![Temperature Controller](Temperature-Controller.png)

The Topology can be accessed on the GUI of TaS.
The noderedflow is the default flow when open the nodered application

# Security

## No built-in authentication

The TaS service currently ships **without any built-in authentication or
authorization**. The web dashboard, the REST API, the MQTT broker, and Node-RED
do not require credentials, and there is no user/role model. In practice:

- Any client that can reach the HTTP/WebSocket end-points can view and modify
  the dashboard, models, data recorders, and simulations.
- Any client that can reach the MQTT port can publish and subscribe as a broker
  client.

## Deployment baseline

Treat the service as **untrusted**. The safe baseline is to never expose it to
an untrusted or public network:

- Bind published ports to loopback only (`127.0.0.1`), or to a private network
  interface whose network is trusted.
- Do not publish the ports to `0.0.0.0` or forward them from a public host or
  load balancer.
- If the service must be reachable from an untrusted network, put an
  authenticated reverse proxy (with TLS) in front of it today; real
  authentication scoped to TaS itself is planned and, once available, will let
  you retire that workaround.

The quick-start `docker run` on this page already reflects this baseline by
binding to loopback.

## Reporting a security issue

See [SECURITY.md](SECURITY.md) for how to report a vulnerability privately. We
ask that you **do not** disclose unknown issues on public channels before they
are triaged.

# License
Montimage