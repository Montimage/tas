const { SIMULATING, OFFLINE } = require("../DeviceStatus");
const ds = require("../DataSourceType");
const abnormalBehaviours = require("../AbnormalBehaviours");
const DataSource = require("./data-sources/DataSource");
const DeviceDataSource = require("./DeviceDataSource");

class DataGenerator extends DeviceDataSource {
  constructor(instanceId, dataHandler, dataResourceConfig, objectId) {
    super(instanceId, dataHandler);
    const {
      timePeriod,
      sources,
      dosAttackSpeedUpRate,
      timeBeforeFailed,
      sensorBehaviours,
      withEnergy,
      energy,
      isIPSOFormat,
    } = dataResourceConfig;
    this.timePeriod = timePeriod;
    this.isIPSOFormat = isIPSOFormat;
    this.objectId = objectId ? objectId : null;
    this.originalTimePeriod = timePeriod;
    this.dosAttackSpeedUpRate = dosAttackSpeedUpRate ? dosAttackSpeedUpRate : 0;
    this.timeBeforeFailed = timeBeforeFailed ? timeBeforeFailed : 0;
    this.startedTime = 0;
    this.sensorBehaviours = sensorBehaviours ? sensorBehaviours : [];
    if (this.sensorBehaviours.length > 0) {
      if (
        sensorBehaviours.indexOf(abnormalBehaviours.AB_NODE_FAILED) > -1 &&
        timeBeforeFailed === 0
      ) {
        console.error(
          `[${this.instanceId}] Cannot initialize this sensor! timeBeforeFailed is 0`
        );
        return null;
      }
      if (
        sensorBehaviours.indexOf(abnormalBehaviours.AB_DOS_ATTACK) > -1 &&
        dosAttackSpeedUpRate === 0
      ) {
        console.error(
          `[${this.instanceId}] Cannot initialize this sensor! dosAttackSpeedUpRate is 0`
        );
        return null;
      }
    }
    if (energy && withEnergy) {
      if (energy.type !== ds.DS_ENERGY) {
        console.warn(
          `[${this.instanceId}] Energy data source is invalid: ${energy.type}`
        );
      }
      const energySource = new DataSource(energy.key, ds.DS_ENERGY, energy);
      this.energy = energySource;
    }
    this.sources = [];
    if (sources && sources.length > 0) {
      sources.map((s) => {
        const newSource = new DataSource(s.key, s.type, s);
        this.sources.push(newSource);
      });
    }
    this.values = null;
  }

  collectAndReportData() {
    this.values = {};
    if (this.energy) {
      // Update energy data field
      const value = this.energy.getValue();
      this.values[this.energy.key] = value;
    }
    // get other data
    for (let index = 0; index < this.sources.length; index++) {
      const source = this.sources[index];
      const value = source.getValue();
      this.values[source.key] = value;
    }
    this.dataHandler({ values: this.values});
  }

  collectAndReportDataInIPSOFormat() {
    this.values = [];
    if (this.energy) {
      // Update energy data field
      const value = this.energy.getValue();
      this.values.push({
        objectId: this.objectId,
        instanceId: this.instanceId,
        ...value,
      });
    }
    // get other data
    for (let index = 0; index < this.sources.length; index++) {
      const source = this.sources[index];
      const value = source.getValue();
      this.values.push({
        objectId: this.objectId,
        instanceId: this.instanceId,
        ...value,
      });
    }
    this.dataHandler({ values: this.values});
  }

  start() {
    super.start();
    this.startedTime = Date.now();
    const timerID = setInterval(() => {
      // Check the status
      if (this.status !== SIMULATING) {
        clearInterval(timerID);
        return;
      }

      // Check the time based behaviour: NODE_FAILED
      const currentTime = Date.now();
      if (this.sensorBehaviours.length > 0) {
        if (
          this.sensorBehaviours.indexOf(abnormalBehaviours.AB_NODE_FAILED) > -1
        ) {
          if (currentTime - this.startedTime >= this.timeBeforeFailed * 1000) {
            console.log(`[${this.instanceId}] Going to FAIL!`);
            this.stop();
          }
        }

        // Check the time based behaviour: SLOW_DOS_ATTACK
        if (
          this.sensorBehaviours.indexOf(abnormalBehaviours.AB_SLOW_DOS_ATTACK) >
          -1
        ) {
          if (this.timePeriod === this.originalTimePeriod) {
            this.timePeriod += 1; // Increase 1 second
            console.log(
              `[${this.instanceId}] Injecting SLOW_DOS_ATTACK with new time period: ${this.timePeriod} (original: ${this.originalTimePeriod})`
            );
            clearInterval(timerID);
            return this.start();
          }
        }

        // Check the time based behaviour: DOS_ATTACK
        if (
          this.sensorBehaviours.indexOf(abnormalBehaviours.AB_DOS_ATTACK) > -1
        ) {
          if (this.timePeriod === this.originalTimePeriod) {
            this.timePeriod = this.timePeriod / this.dosAttackSpeedUpRate; // Increase 1 second
            console.log(
              `[${this.instanceId}] Injecting DOS_ATTACK with new time period: ${this.timePeriod} (original: ${this.originalTimePeriod})`
            );
            clearInterval(timerID);
            return this.start();
          }
        }

        if (this.energy) {
          // Check the energy behaviour: OUT_OF_ENERGY
          if (
            this.sensorBehaviours.indexOf(abnormalBehaviours.AB_OUT_OF_ENERGY) >
            -1
          ) {
            if (this.energy.value <= 0) {
              console.log(`[${this.instanceId}] Out of energy. Going to STOP!`);
              this.stop();
            }
          }
          // Check the energy behaviour: LOW_ENERGY
          const low_energy_index = this.sensorBehaviours.indexOf(
            abnormalBehaviours.AB_LOW_ENERGY
          );
          if (low_energy_index > -1) {
            if (this.energy.value <= this.energy.dataGenerator.low) {
              console.log(
                `[${this.instanceId}] Low energy. Going to change the frequency!`
              );
              this.timePeriod =
                this.timePeriod * this.energy.dataGenerator.slowDownRate;
              this.sensorBehaviours.splice(low_energy_index, 1);
              clearInterval(timerID);
              return this.start();
            }
          }
        }
      }
      // Collect and handle data
      if (this.isIPSOFormat) {
        this.collectAndReportDataInIPSOFormat();
      } else {
        this.collectAndReportData();
      }
    }, this.timePeriod * 1000);
  }
}

module.exports = DataGenerator;
