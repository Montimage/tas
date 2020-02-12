const randomBoolean = () => Math.random() < 0.5 ? 0: 1;

const randomIntegerValue = (min, max) => {
  const rand = Math.random();
  return Math.round(min + rand * (max-min));
}

const randomDoubleValue = (min, max) => {
  const rand = Math.random();
  return Math.round(100*(min + rand * (max-min)))/100;
}

module.exports = {
  randomDoubleValue,
  randomIntegerValue,
  randomBoolean,
}