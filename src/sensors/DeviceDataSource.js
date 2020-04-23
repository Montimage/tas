const { SIMULATING, OFFLINE } = require("../DeviceStatus");

class DeviceDataSource {
  constructor(instanceId,dataHandler) {
    this.dataHandler = dataHandler;
    this.status = OFFLINE;
    this.instanceId = instanceId;
  }

  getStatus() {
    return this.status;
  }

  start() {
    this.status = SIMULATING;
  }

  stop() {
    if (this.status === OFFLINE) {
      console.log(`[${this.instanceId}] is offline!`);
    } else {
      this.status = OFFLINE;
      console.log(
        `[${this.instanceId}] stopped at: ${new Date().toLocaleTimeString()}`
      );
    }
  }
}

module.exports = DeviceDataSource;