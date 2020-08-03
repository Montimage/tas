const { SIMULATING, OFFLINE } = require("../DeviceStatus");

class DeviceDataSource {
  constructor(id,dataHandler, callbackWhenFinish = null) {
    this.dataHandler = dataHandler;
    this.status = OFFLINE;
    this.id = id;
    this.callbackWhenFinish = callbackWhenFinish;
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
      if (this.callbackWhenFinish) this.callbackWhenFinish();
    }
  }
}

module.exports = DeviceDataSource;