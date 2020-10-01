const Simulation = require("./Simulation");
const { readJSONFile } = require("../utils");

if (process.argv[2] === "test") {
  readJSONFile(process.argv[3], (err, model) => {
    if (err) {
      console.error(
        `[Simulation] [ERROR] Cannot read the config of thing:`,
        process.argv[3]
      );
      // console.error();
    } else {
      if (!model.devices || model.devices.length === 0) {
        console.error(
          `[Simulation] [ERROR] There is no simulation:`,
          process.argv[3]
        );
      } else {
        const simulation = new Simulation(model);
        simulation.start();
      }
    }
  });
}

module.exports = Simulation;
