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
    this.upstreams = null;
  }

  /**
   * Handle the sensor's data which are published by a THING
   * - Based on the router configuration, this message will be published on some specific channels
   * @param {String} thingID The ThingID
   * @param {String} topic The topic of the packet
   * @param {String} message The payload of the packet
   * @param {Object} packet The packet
   */
  handleUpstreamData (thingID, topic, message, packet) {
    if (this.upstreams) {
      const filteredUpstreams = this.upstreams.filter((r) => r.in === thingID);
      if (!filteredUpstreams || filteredUpstreams.length === 0) {
        console.warn(`[GW ${this.id}] Unhandled message from ${thingID}: ${topic}`);
      } else {
        for (let index = 0; index < filteredUpstreams.length; index++) {
          const fRouter = filteredUpstreams[index];
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
   * Handle the actuated's data which should be sent to the THING which contains the actuator
   * @param {String} extId The id of external communication
   * @param {String} topic The topic of the packet, the topic should contain the id of the actuator which will received the actuated data
   * TODO: should the topic contain the id of the thing?
   *  - each downstream message should control 1 actuator which is belong to 1 thing
   *  - How about a broadcast ??? - should not
   * @param {String} message The payload of the packet
   * @param {Object} packet The packet
   */
  handleDownstreamData (extId, topic, message, packet) {
    console.log(`[GW ${this.id}] Handle message from ${extId}: ${topic}`);
    const externalComm = this.extComms[extId];
    const downstreamTopic = externalComm.subTopic.replace('#','');
    const subTopic = topic.replace(downstreamTopic,'');
    const array = subTopic.split('/');
    // Remove duplicated token to avoid forward the message more than 1 time to 1 THING
    const pubIDs = [];
    for (let index = 0; index < array.length; index++) {
      if (pubIDs.indexOf(array[index]) === -1) {
        pubIDs.push(array[index]);
      }
    }

    let foundPub = false;
    for (let index = 0; index < pubIDs.length; index++) {
      const pubID = pubIDs[index];
      if (this.thingComms[pubID]) {
        foundPub = true;
        const mergedTopic = `things/${pubID}/actuators/${topic}`;
        // TODO: can add more rules here to specific the Thing to be transfer the message to
        console.log(`[GW ${this.id}] Going to send message to channel ${mergedTopic}`);
        this.thingComms[pubID].publish(mergedTopic, message);
      }
    }
    if (!foundPub) {
      console.log(`[GW ${this.id}] Cannot find any THING to forward the message ${topic}`);
    }
  }

  /**
   * Add a new Communication for a thing
   * @param {String} thingID The ThingID
   * @param {Object} mqttConfig The configuration to create a mqtt client
   */
  addNewThing ( thingID, mqttConfig ) {
    const newThingComm = new Communication(thingID, mqttConfig, (id, topic, message, packet) => {
      this.handleUpstreamData(id, topic, message, packet);
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
      this.handleDownstreamData(id, topic, message, packet);
    });
    newExtComm.initConnection(() => {
      newExtComm.subscribe(subTopic);
      this.extComms[extId] = newExtComm;
    });
  }

  /**
   * Update the router of the gateway
   * @param {Object} upstreams The configuration of the router in the gateway
   */
  updateUpstreams( upstreams) {
    this.upstreams = upstreams;
  }

  /**
   * Show the gateway
   */
  show() {
    console.log(`\n---------\nGateway: ${this.id}`);
    console.log('Things: \n', this.thingComms);
    console.log('External Components: \n', this.extComms);
    console.log('upstreams: \n',this.upstreams );
    console.log('\n---------\n');
  }
}

module.exports = Gateway;