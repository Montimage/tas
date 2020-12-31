const {
  SIMULATING,
  OFFLINE
} = require("../DeviceStatus");

const DeviceDataSource = require('./DeviceDataSource');

class DataReplayer extends DeviceDataSource {
  constructor(id, dataHandler, callbackWhenFinish, replayOptions, events, objectId, startReplayingTime) {
    super(id, dataHandler, callbackWhenFinish);
    this.objectId = objectId;
    this.repeat = false;
    this.speedup = 1;
    if (replayOptions) {
      if (replayOptions.repeat) this.repeat = replayOptions.repeat;
      if (replayOptions.speedup) this.speedup = replayOptions.speedup;
    }
    this.events = events;
    this.nbRepeated = 0;
    this.startReplayingTime = startReplayingTime;
  }

  getStats() {
    return {
      startTime: this.startTime,
      endTime: this.endTime,
      repeat: this.repeat,
      speedup: this.speedup,
      numberOfRepeats: this.nbRepeated
    };
  }

  replayEvent(event, waitingTime, isLastEvent = false) {
    setTimeout(() => {
      if (this.status === SIMULATING) {
        const {
          values, topic
        } = event;
        // console.log('Going to replaying event: ', event);
        this.dataHandler(values, topic);
        if (isLastEvent) {
          if (!this.repeat) {
            console.log(`[${this.id}] Finished!`);
            super.stop();
          } else {
            console.log('Go to next repeating!');
            this.replayData();
          }
        }
      }
    }, waitingTime);
  }

  replayData() {
    this.nbRepeated++;
    if (!this.events) {
      console.error(`[ERROR] No data to be replayed`);
      return;
    }
    const startTime = this.startReplayingTime;
    for (let index = 0; index < this.events.length; index++) {
      const event = this.events[index];
      const waitingTime = (event.timestamp - startTime) / this.speedup;
      if (index === 0) console.log(`First event timestamp: ${event.timestamp}, waiting time ${waitingTime/1000} (seconds) at ${new Date()}`);
      if (this.status === SIMULATING) {
        this.replayEvent(event, waitingTime, index === this.events.length - 1);
      }
    }
  }

  start() {
    super.start();
    this.replayData();
  }
}

module.exports = DataReplayer;
