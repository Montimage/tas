/**
 *
 * @param {Object} obj Object to be updated
 * @param {String} path Path to be updated
 * @param {Value} value the new value to be updated
 */
const updateObjectByPath = (obj, path, value) => {
  var stack = path.split('.');
  while(stack.length>1){
    const key = stack.shift();
    if (!obj[key]) {
      obj[key]={};
    }
    obj = obj[key];
  }
  obj[stack.shift()] = value;
}

export {
  updateObjectByPath
}