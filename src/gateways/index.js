/**
 * Start simulating a gateway
 *
 *    node src/gateways/index.js gw-01-config.json
 *
 */

const Gateway = require('./Gateway');
const { readJSONFile } = require('../utils');

const gwConfigFile = process.argv[2];

readJSONFile(gwConfigFile, (err, gwConfig) => {
  if (err) {
    console.error(`[ERROR] Cannot read the config of gateway:`, gwConfigFile);
  } else {
    const {id, things, externals, upstreams } = gwConfig;
    const gw = new Gateway(id);
    // Add things
    for (let index = 0; index < things.length; index++) {
      const {id, mqttConfig} = things[index];
      gw.addNewThing(id, mqttConfig);
    }
    // Add externals components
    for (let index = 0; index < externals.length; index++) {
      const {id, mqttConfig, subTopic} = externals[index];
      gw.addNewExternalComponent(id, mqttConfig, subTopic);
    }
    // Update the routers
    gw.updateUpstreams(upstreams);
    setTimeout(() => {
      gw.show();
    }, 3000);
  }
});