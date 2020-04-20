const { SIMULATING, OFFLINE } = require("../DeviceStatus");
const ds = require("../DataSourceType");
const abnormalBehaviours = require("../AbnormalBehaviours");
const DataSource = require("./data-sources/DataSource");
const DeviceDataSource = require('./DeviceDataSource');

class DataGenerator extends DeviceDataSource{
  constructor(parentID, userData, options, publishDataFct, dataResource) {
    super(parentID, userData, options, publishDataFct);
    const {
      timePeriod,
      sources,
      dosAttackSpeedUpRate,
      timeBeforeFailed,
      sensorBehaviours,
      energy,
    } = dataResource;
    this.timePeriod = timePeriod;
    this.originalTimePeriod = timePeriod;
    this.dosAttackSpeedUpRate = dosAttackSpeedUpRate ? dosAttackSpeedUpRate : 0;
    this.timeBeforeFailed = timeBeforeFailed ? timeBeforeFailed : 0;
    this.startedTime = 0;
    this.value = { userData };
    this.sensorBehaviours = sensorBehaviours ? sensorBehaviours : [];
    if (sensorBehaviours.length > 0) {
      if (
        sensorBehaviours.indexOf(abnormalBehaviours.AB_NODE_FAILED) > -1 &&
        timeBeforeFailed === 0
      ) {
        console.error(
          `[${this.parentID}] Cannot initialize this sensor! timeBeforeFailed is 0`
        );
        return null;
      }
      if (
        sensorBehaviours.indexOf(abnormalBehaviours.AB_DOS_ATTACK) > -1 &&
        dosAttackSpeedUpRate === 0
      ) {
        console.error(
          `[${this.parentID}] Cannot initialize this sensor! dosAttackSpeedUpRate is 0`
        );
        return null;
      }
    }

    if (energy) {
      if (energy.type !== ds.DS_ENERGY) {
        console.warn(
          `[${this.parentID}] Energy data source is invalid: ${energy.type}`
        );
      }
      const energySource = new DataSource(energy.key, ds.DS_ENERGY, energy);
      this.value[energySource.key] = energySource.getValue();
      this.energy = energySource;
    }
    this.sources = [];
    if (sources && sources.length > 0) {
      sources.map((s) => {
        const newSource = new DataSource(s.key, s.type, s);
        this.value[newSource.key] = newSource.getValue();
        this.sources.push(newSource);
      });
    }
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
            console.log(`[${this.parentID}] Going to FAIL!`);
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
              `[${this.parentID}] Injecting SLOW_DOS_ATTACK with new time period: ${this.timePeriod} (original: ${this.originalTimePeriod})`
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
              `[${this.parentID}] Injecting DOS_ATTACK with new time period: ${this.timePeriod} (original: ${this.originalTimePeriod})`
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
              console.log(`[${this.parentID}] Out of energy. Going to STOP!`);
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
                `[${this.parentID}] Low energy. Going to change the frequency!`
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
      if (this.energy) {
        this.energy.readData();
        // Update energy data field
        this.value[this.energy.key] = this.energy.getValue();
      }
      // get other data
      for (let index = 0; index < this.sources.length; index++) {
        const source = this.sources[index];
        source.readData();
        this.value[source.key] = source.getValue();
      }
      const timestamp = Date.now();
      // console.log("Timer: ", new Date(timestamp).toLocaleTimeString());
      // SEND DATA
      this.publishDataFct(
        { timestamp, id: this.parentID, name: this.name, value: this.value },
        this.parentID,
        this.options
      );
    }, this.timePeriod * 1000);
  }
}

module.exports = DataGenerator;