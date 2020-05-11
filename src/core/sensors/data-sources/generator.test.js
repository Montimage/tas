const gen = require("./generator");

const min = -273;
const max = 100;
const regularMin = 0;
const regularMax = 35;
let integerLastValue = 20;
let floatLastValue = 20;
const step = 2;
let index = 0;
const NB_TEST = 5000;
let failed1 = 0;
let failed2 = 0;
let failed3 = 0;
let failed4 = 0;
let failed5 = 0;
let failed6 = 0;
while (index < NB_TEST) {
  index++;
  // Float
  const floatOutOfRange = gen.getFloatOutOfRange(min, max);
  if (floatOutOfRange > min && floatOutOfRange < max) {
    // console.error("FAILED 1: ", floatOutOfRange);
    failed1++;
  }
  const floatOutOfRegularRange = gen.getFloatOutOfRegularRange(
    min,
    max,
    regularMin,
    regularMax
  );
  if (
    floatOutOfRegularRange > regularMin &&
    floatOutOfRegularRange < regularMax
  ) {
    // console.error("FAILED 2: ", floatOutOfRegularRange);
    failed2++;
  }
  const floatOutOfRegularStep = gen.getFloatOutOfRegularStep(
    regularMin,
    regularMax,
    step,
    floatLastValue
  );
  if (
    floatOutOfRegularStep < regularMin ||
    floatOutOfRegularStep > regularMax ||
    Math.abs(floatOutOfRegularStep - floatLastValue) < step
  ) {
    console.error("FAILED 3: ", floatOutOfRegularStep);
    console.error(regularMin, regularMax, step, floatLastValue);
    failed3++;
  } else {
    floatLastValue = floatOutOfRegularStep;
  }

  // Integer
  const integerOutOfRange = gen.getIntegerOutOfRange(min, max);
  if (integerOutOfRange > min && integerOutOfRange < max) {
    // console.error("FAILED 4: ", integerOutOfRange);
    failed4++;
  }
  const integerOutOfRegularRange = gen.getIntegerOutOfRegularRange(
    min,
    max,
    regularMin,
    regularMax
  );
  if (
    integerOutOfRegularRange > regularMin &&
    integerOutOfRegularRange < regularMax
  ) {
    // console.error("FAILED 5: ", floatOutOfRegularRange);
    failed5++;
  }
  const integerOutOfRegularStep = gen.getIntegerOutOfRegularStep(
    regularMin,
    regularMax,
    step,
    integerLastValue
  );
  if (
    integerOutOfRegularStep < regularMin ||
    integerOutOfRegularStep > regularMax ||
    Math.abs(integerOutOfRegularStep - integerLastValue) < step
  ) {
    console.error("FAILED 6: ", integerOutOfRegularStep);
    console.error(regularMin, regularMax, step, integerLastValue);
    failed6++;
  }else{
    integerLastValue = integerOutOfRegularStep;
  }
}

console.log(failed1);
console.log(failed2);
console.log(failed3);
console.log(failed4);
console.log(failed5);
console.log(failed6);

const testValue = gen.getIntegerOutOfRegularStep(2,8,2, 5);
console.log(testValue);