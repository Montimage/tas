const Communication = require('./Communication');
/**
 * The Gateway class presents a gateway
 * - Communicates using MQTT protocol
 * - Communicate with the THING (can be multiple THINGs)
 *    - Receives data from the THING (sensors' data, can be multiple sensors)
 *    - Send data to the THING (actuators' data to actuate, can be multiple actuators)
 * - Communicate with other services/gateways, etc.
 *    - Send data
 *    - Receive data
 */
class Gateway {
  constructor(id) {
    this.id = id;
    this.thingComms = {};
    this.extComms = {};
    this.routers = null;
  }

  /**
   * Handle the sensor's data which are published by a THING
   * - Based on the router configuration, this message will be published on some specific channels
   * @param {String} thingID The ThingID
   * @param {String} topic The topic of the packet
   * @param {String} message The payload of the packet
   * @param {Object} packet The packet
   */
  handleSensorData (thingID, topic, message, packet) {
    if (this.routers) {
      const filteredRouters = this.routers.filter((r) => r.in === thingID);
      if (!filteredRouters || filteredRouters.length === 0) {
        console.warn(`[GW ${this.id}] Unhandled message from ${thingID}: ${topic}`);
      } else {
        for (let index = 0; index < filteredRouters.length; index++) {
          const fRouter = filteredRouters[index];
          const { out } = fRouter;
          for (let oi = 0; oi < out.length; oi++) {
            const pubID = out[oi];
            if (this.extComms[pubID]) {
              this.extComms[pubID].publish(topic, message);
            } else {
              console.error(`[GW ${this.id}] Externals Communication does not exist! ${pubID}`);
            }
          }
        }
      }
    } else {
      console.warn(`[GW ${this.id}] Missing router!`);
    }
  }

  /**
   * Handle the sensor's data which are published by a THING
   * @param {String} extId The id of external communication
   * @param {String} topic The topic of the packet
   * @param {String} message The payload of the packet
   * @param {Object} packet The packet
   */
  handleActuatedData (extId, topic, message, packet) {
    if (this.routers) {
      const filteredRouters = this.routers.filter((r) => r.in === extId);
      if (!filteredRouters || filteredRouters.length === 0) {
        console.warn(`[GW ${this.id}] Unhandled message from ${extId}: ${topic}`);
      } else {
        for (let index = 0; index < filteredRouters.length; index++) {
          const fRouter = filteredRouters[index];
          const { out } = fRouter;
          for (let oi = 0; oi < out.length; oi++) {
            const pubID = out[oi];
            if (this.thingComms[pubID]) {
              this.thingComms[pubID].publish(topic, message);
            } else {
              console.error(`[GW ${this.id}] Externals Communication does not exist! ${pubID}`);
            }
          }
        }
      }
    } else {
      console.warn(`[GW ${this.id}] Missing router!`);
    }
  }

  /**
   * Add a new Communication for a thing
   * @param {String} thingID The ThingID
   * @param {Object} mqttConfig The configuration to create a mqtt client
   */
  addNewThing ( thingID, mqttConfig ) {
    const newThingComm = new Communication(thingID, mqttConfig, (id, topic, message, packet) => {
      this.handleSensorData(id, topic, message, packet);
    });
    const subTopic = `things/${thingID}/sensors/#`;
    newThingComm.initConnection(() => {
      newThingComm.subscribe(subTopic);
      this.thingComms[thingID] = newThingComm;
    });
  }

  /**
   * Add a new communication with external component
   * @param {String} extId The id of external communication
   * @param {Object} mqttConfig the configuration to create a mqtt client
   * @param {String} subTopic the topic to listen on
   */
  addNewExternalComponent ( extId, mqttConfig, subTopic ) {
    const newExtComm = new Communication(extId, mqttConfig, (id, topic, message, packet) => {
      this.handleActuatedData(id, topic, message, packet);
    });
    newExtComm.initConnection(() => {
      newExtComm.subscribe(subTopic);
      this.extComms[extId] = newExtComm;
    });
  }

  /**
   * Update the router of the gateway
   * @param {Object} routers The configuration of the router in the gateway
   */
  updateRouter( routers) {
    this.routers = routers;
  }

  /**
   * Show the gateway
   */
  show() {
    console.log(`\n---------\nGateway: ${this.id}`);
    console.log('Things: \n', this.thingComms);
    console.log('External Components: \n', this.extComms);
    console.log('Routers: \n',this.routers );
    console.log('\n---------\n');
  }
}

module.exports = Gateway;