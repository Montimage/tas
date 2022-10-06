const { DATABASE, EventSchema, TestCaseSchema } = require("./index");

const mydb = new DATABASE("localhost", 27017, "tasdb");
mydb.connect(() => {
  // EventSchema.findEventsBetweenTimes(
  //   { topic: "devices/device-01/sensors/motion", datasetId: "my-data-set" },
  //   0,
  //   Date.now(),
  //   (err, events) => {
  //     if (err) {
  //       console.error("[DataStorage] Cannot get any events!");
  //     } else {
  //       console.log("events: ", events);
  //     }
  //   }
  // );
  const testCaseId = 'my-test-case-02';
  TestCaseSchema.findOne({id: testCaseId}, (err, tc) => {
    if (err) {
      console.error(`[DataStorage] Cannot get test Case: ${testCaseId}`, err);
      return ;
    } else if (!tc) {
      console.error(`[DataStorage] Cannot get test Case: ${testCaseId}. TestCase is null`);
      return ;
    } else {
      console.log(tc);
    }
  });
});
