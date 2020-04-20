const { SIMULATING, OFFLINE } = require("../DeviceStatus");

class DeviceDataSource {
  constructor(parentID, userData, options, publishDataFct) {
    this.parentID = parentID;
    this.userData = userData;
    this.publishDataFct = publishDataFct;
    this.options = options;
  }

  getStatus() {
    return this.status;
  }

  start() {
    this.status = SIMULATING;
  }

  stop() {
    if (this.status === OFFLINE) {
      console.log(`[${this.parentID}] is offline!`);
    } else {
      this.status = OFFLINE;
      console.log(
        `[${this.parentID}] stopped at: ${new Date().toLocaleTimeString()}`
      );
    }
  }
}

module.exports = DeviceDataSource;