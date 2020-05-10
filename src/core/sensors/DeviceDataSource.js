const { SIMULATING, OFFLINE } = require("../DeviceStatus");

class DeviceDataSource {
  constructor(id,dataHandler) {
    this.dataHandler = dataHandler;
    this.status = OFFLINE;
    this.id = id;
  }

  getStatus() {
    return this.status;
  }

  start() {
    this.status = SIMULATING;
  }

  stop() {
    if (this.status === OFFLINE) {
      console.log(`[${this.id}] is offline!`);
    } else {
      this.status = OFFLINE;
      console.log(
        `[${this.id}] stopped at: ${new Date().toLocaleTimeString()}`
      );
    }
  }
}

module.exports = DeviceDataSource;