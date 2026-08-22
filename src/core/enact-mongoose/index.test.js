const { ENACTDB, TestCaseSchema } = require('./index');

const mydb = new ENACTDB('localhost', 27017, 'tasdb');
mydb.connect(async () => {
  const testCaseId = 'my-test-case-02';
  try {
    const tc = await TestCaseSchema.findOne({ id: testCaseId });
    if (!tc) {
      console.error(`[DataStorage] Cannot get test Case: ${testCaseId}. TestCase is null`);
      return;
    }
    console.log(tc);
  } catch (err) {
    console.error(`[DataStorage] Cannot get test Case: ${testCaseId}`, err);
  }
});
