/**
 *
 * @param {Object} obj Object to be updated
 * @param {String} path Path to be updated
 * @param {Value} value the new value to be updated
 */
const updateObjectByPath = (obj, path, value) => {
  var stack = path.split(".");
  while (stack.length > 1) {
    const key = stack.shift();
    if (!obj[key]) {
      obj[key] = {};
    }
    obj = obj[key];
  }
  obj[stack.shift()] = value;
};

/**
 * Add new element into array
 * @param {Array} array The array to be added
 * @param {Object} newElement New element to be updated or added
 */
const addNewElementToArray = (array, newElement) => {
  let found = false;
  for (let index = 0; index < array.length; index++) {
    const element = array[index];
    if (element.id === newElement.id) {
      // Found the element - update
      array[index] = {...newElement};
      // array.splice(index, 1);
      // array.push(newElement);
      found = true;
      break;
    }
  }
  if (!found) {
    array.push(newElement);
  }
  return array;
};

const removeElementFromArray = (array, elmId) => {
  let isDeleted = false;
  for (let index = 0; index < array.length; index++) {
    const element = array[index];
    if (element.id === elmId) {
      array.splice(index, 1);
      isDeleted = true;
      break;
    }
  }
  if (!isDeleted) {
    console.log(`[ERROR] Cannot find the element: ${elmId}`);
    return null;
  }
  return array;
}

const getCreatedTimeFromFileName = (fileName) => {
  const array = fileName.split('_');
  let timeString = array[array.length - 1].replace('.log','');
  return new Date(Number(timeString));
}

export { updateObjectByPath, addNewElementToArray, removeElementFromArray, getCreatedTimeFromFileName };
