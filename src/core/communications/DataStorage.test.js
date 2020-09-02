const DataStorage = require("./DataStorage");

const ds = new DataStorage({
  protocol: "MONGODB",
  connConfig: {
    host: "localhost",
    port: 27017,
    dbname: "homeiodb",
  },
});

const testCaseId = 'my-test-case-02';
ds.connect((err) => {
  if (err) return console.error(err);
  // ds.getTestCaseById(testCaseId, (err, tc) => {
  //   console.log(err | tc);
  // });
  console.log('Going to perform some tests');
  // ds.saveDataset({
  //   id: 'my-data-set-05',
  //   name: 'this is my dataset',
  //   description: 'description',
  //   tags:[]
  // });

  ds.getEvents(
    "enact/sensors/cec/status",
    "homeio-dataset-01",
    {},
    (err2, events) => {
      if (err2) return console.error(err2);
      console.log("Events: ", events);
    }
  );
});
