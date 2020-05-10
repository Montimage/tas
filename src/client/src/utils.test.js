/**
 *
 * @param {Object} obj Object to be updated
 * @param {String} path Path to be updated
 * @param {Value} value the new value to be updated
 */
const updateObjectByPath = (obj, path, value, index = null) => {
  let stack = path.split(".");
  while (stack.length > 1) {
    const key = stack.shift();
    if (!obj[key]) {
      obj[key] = {};
    }
    obj = obj[key];
  }
  let lastKey = stack.shift();
  if (index===null || !(obj[lastKey] instanceof Array) ) {
    obj[lastKey] = value;
  } else {
    // Update an array
    if (index < obj[lastKey].length) {
      // Update an element in array
      obj[lastKey][index] = value;
    } else {
      // add new element in array -> always append at the end of the array no matter what is the index
      obj[lastKey].push(value);
    }
  }
};

const obj = {
  id: 123,
  name: 'Louis',
  address: {
    phone: "NO",
    home:"2 residence du verger"
  },
  accounts: [
    {
      name: 'BNP',
      amount: 11
    },
    {
      name: 'LBB',
      amount: 12
    },
    {
      name: 'Bourse',
      amount: 13
    }
  ]
};

console.log(obj);
updateObjectByPath(obj, "name","Mai");
console.log(obj);
updateObjectByPath(obj, "address.home","Vietnam");
console.log(obj);
updateObjectByPath(obj, "accounts",{name: "PP", amount: 11}, 4);
console.log(obj);
updateObjectByPath(obj, "accounts",{name: "PP", amount: 11}, 1);
console.log(obj);
