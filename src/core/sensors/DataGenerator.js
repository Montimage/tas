const { SIMULATING, OFFLINE } = require("../DeviceStatus");
const ds = require("../DataSourceType");
const abnormalBehaviours = require("../AbnormalBehaviours");
const DataSource = require("./data-sources/DataSource");
const DeviceDataSource = require("./DeviceDataSource");

class DataGenerator extends DeviceDataSource {
  constructor(id, dataHandler, callbackWhenFinish, dataSpecs, objectId, reportFormat = 0) {
    super(id, dataHandler, callbackWhenFinish);
    const {
      timePeriod,
      sources,
      dosAttackSpeedUpRate,
      timeBeforeFailed,
      sensorBehaviours,
      withEnergy,
      energy,
      isIPSOFormat,
    } = dataSpecs;
    this.timePeriod = timePeriod;
    this.reportFormat = reportFormat;
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
          `[${this.id}] Cannot initialize this sensor! timeBeforeFailed is 0`
        );
        return null;
      }
      if (
        sensorBehaviours.indexOf(abnormalBehaviours.AB_DOS_ATTACK) > -1 &&
        dosAttackSpeedUpRate === 0
      ) {
        console.error(
          `[${this.id}] Cannot initialize this sensor! dosAttackSpeedUpRate is 0`
        );
        return null;
      }
    }
    if (energy && withEnergy) {
      if (energy.type !== ds.DS_ENERGY) {
        console.warn(
          `[${this.id}] Energy data source is invalid: ${energy.type}`
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
    // console.log(`REPORT FORMAT: ${this.reportFormat}`);
  }

  getStats() {
    let numberOfMeasurements = this.sources.length;
    if (this.withEnergy) numberOfMeasurements++;
    return {
      timePeriod: this.timePeriod,
      sensorBehaviours: this.sensorBehaviours,
      numberOfMeasurements,
    }
  }

  collectAndReportPlainData() {

    if (!this.energy && this.sources.length === 1) {
      this.values = this.sources[0].getValue().value;
    } else {
      this.values = [];
      // get other data
      for (let index = 0; index < this.sources.length; index++) {
        const source = this.sources[index];
        const value = source.getValue();
        this.values.push(value);
      }
      if(this.energy) {
        this.values.push(this.energy.getValue());
      }
    }
    // console.log(`[DataGenerator] collect and report plain data: ${JSON.stringify(this.values)}`);
    this.dataHandler(this.values);
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
    this.dataHandler(this.values);
  }

  collectAndReportDataInIPSOFormat() {
    this.values = [];
    if (this.energy) {
      // Update energy data field
      const value = this.energy.getValue();
      this.values.push({
        objectId: this.objectId,
        instanceId: this.id,
        ...value,
      });
    }
    // get other data
    for (let index = 0; index < this.sources.length; index++) {
      const source = this.sources[index];
      const value = source.getValue();
      this.values.push({
        objectId: this.objectId,
        instanceId: this.id,
        ...value,
      });
    }
    this.dataHandler(this.values);
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
            console.log(`[${this.id}] Going to FAIL!`);
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
              `[${this.id}] Injecting SLOW_DOS_ATTACK with new time period: ${this.timePeriod} (original: ${this.originalTimePeriod})`
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
            this.timePeriod = this.timePeriod / this.dosAttackSpeedUpRate;
            console.log(
              `[${this.id}] Injecting DOS_ATTACK with new time period: ${this.timePeriod} (original: ${this.originalTimePeriod})`
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
              console.log(`[${this.id}] Out of energy. Going to STOP!`);
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
                `[${this.id}] Low energy. Going to change the frequency!`
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
      if (this.reportFormat === 2) {
        this.collectAndReportDataInIPSOFormat();
      } else if (this.reportFormat === 1) {
        this.collectAndReportData();
      } else {
        this.collectAndReportPlainData();
      }
    }, this.timePeriod * 1000);
  }
}

module.exports = DataGenerator;
