/**
* Start simulating a gateway
*
*    node src/gateways/index.js gw-01-config.json
*
*/

const Gateway = require('./Gateway');
const { readJSONFile } = require('../utils');

const gwConfigFile = process.argv[2];

/**
 * Create a gateway
 * @param {String} id The id of gateway
 * @param {Array} things Array of things to be added
 * @param {Array} externals Array of external components to be added
 * @param {Array} upstreams Array of upstream rules
 */
const createGateway = (id, things, externals, upstreams) => {
  console.log(`[${id}] initializing ...`);
  const gw = new Gateway(id);
  // Add things
  const scaledThings = {};
  for (let index = 0; index < things.length; index++) {
    const { id, mqttConfig, scale } = things[index];
    const nbThings = scale ? scale : 1;
    if (nbThings === 1) {
      gw.addNewThing(id, mqttConfig);
    } else {
      scaledThings[id] = nbThings;
      for (let tIndex = 0; tIndex < nbThings; tIndex++) {
        const tID = `${id}-${tIndex}`;
        gw.addNewThing(tID, mqttConfig);
      }
    }
  }
  // Add externals components
  for (let index = 0; index < externals.length; index++) {
    const { id, mqttConfig, subTopic } = externals[index];
    gw.addNewExternalComponent(id, mqttConfig, subTopic);
  }
  // Update the routers
  for (let index = 0; index < upstreams.length; index++) {
    const usRule = upstreams[index];
    if (scaledThings[usRule.in]) {
      // Need to extend the rule for scaled thing
      for (let rIndex = 0; rIndex < scaledThings[usRule.in]; rIndex++) {
        const newUSRule = {in: `${usRule.in}-${rIndex}`, out: usRule.out};
        gw.addUpstreamRule(newUSRule);
      }
    } else {
      // No need to extend the rule
      gw.addUpstreamRule(usRule);
    }
  }
  // gw.updateUpstreams(upstreams);
  setTimeout(() => {
    gw.show();
  }, 3000);
};

readJSONFile(gwConfigFile, (err, gwConfigs) => {
  if (err) {
    console.error(`[ERROR] Cannot read the config of gateway:`, gwConfigFile);
  } else {
    for (let gwConfigIndex = 0; gwConfigIndex < gwConfigs.length; gwConfigIndex++) {
      const {id, things, externals, upstreams } = gwConfigs[gwConfigIndex];
      createGateway(id, things, externals, upstreams);
    }
  }
});