const updateObjectByPath = (obj, path, value) => {
  let stack = path.split(".");
  while (stack.length > 1) {
    // Not at the end of the path
    let key = stack.shift();
    if (key.indexOf("[") > 0) {
      // Contains array index
      const array = key.split("[");
      key = array[0];
      let index = array[1].replace("]", "");
      if (!obj[key]) {
        // Create a new array if it does not exist
        obj[key] = [];
      }
      if (obj[key].length === 0) {
        // Empty array
        index = 0;
      } else if (obj[key].length <= index || index < 0) {
        // index out of range
        index = obj[key].length;
      }
      if (!obj[key][index]) {
        obj[key].push({});
        // throw Error(`ERROR: Invalid data path: ${path} in object ${JSON.stringify(obj)}`);
      }
      obj = obj[key][index];
    } else {
      if (!obj[key]) {
        // Create a new path if it does not exist
        obj[key] = {};
      }
      obj = obj[key];
    }
  }
  let lastKey = stack.shift();
  // At the end of the path
  if (lastKey.indexOf("[") > 0) {
    // Contains array index
    const array = lastKey.split("[");
    lastKey = array[0];
    let index = array[1].replace("]", "");
    if (value === null) {
      // Remove an element
      if (obj[lastKey] && obj[lastKey][index]) {
        obj[lastKey].splice(index, 1);
      }
    } else {
      // Add an element
      if (!obj[lastKey]) {
        // Create a new array if it does not exist
        obj[lastKey] = [];
      }
      if (obj[lastKey].length === 0) {
        // Empty array
        index = 0;
      } else if (obj[lastKey].length <= index || index < 0) {
        // index out of range
        index = obj[lastKey].length;
      }
      if (!obj[lastKey][index]) {
        obj[lastKey].push(value);
        // throw Error(`ERROR: Invalid data path: ${path} in object ${JSON.stringify(obj)}`);
      } else {
        obj[lastKey][index] = value;
      }
    }
  } else {
    // Not contains array index
    obj[lastKey] = value;
  }
};

const obj = {
  "name": "HomeIO Recorders",
  "dataStorage": {
    "protocol": "MONGODB",
    "connConfig": {
      "host": "192.168.1.21",
      "port": 27017,
      "username": null,
      "password": null,
      "dbname": "homeiodb",
      "options": null
    }
  },
  "dataset": {
    "id": "homeio-dataset-02",
    "name": "HomeIO Dataset 02",
    "description": "This is a new dataset",
    "tags": [
      "recorded",
      "conflict",
      "homeio"
    ]
  },
  "dataRecorders": [{
      "name": "TV status recorder and Actuator",
      "id": "homeio-recorder-01",
      "enable": true,
      "source": {
        "protocol": "MQTT",
        "connConfig": {
          "host": "192.168.1.21",
          "port": 1883,
          "options": null
        },
        "upStreams": [
          "enact/sensors/cec/status"
        ],
        "downStreams": [
          "enact/actuators/smartbox/mute"
        ]
      },
      "forward": {
        "protocol": "MQTT",
        "connConfig": {
          "host": "192.168.1.21",
          "port": 1882,
          "options": null
        }
      }
    },
    {
      "name": "Call Status recorder",
      "id": "call-status-recorder",
      "enable": true,
      "source": {
        "protocol": "MQTT",
        "connConfig": {
          "host": "192.168.1.21",
          "port": 1883,
          "options": null
        },
        "upStreams": [
          "call/status"
        ],
        "downStreams": []
      },
      "forward": {
        "protocol": "MQTT",
        "connConfig": {
          "host": "192.168.1.21",
          "port": 1882,
          "options": null
        }
      }
    }
  ]
};

console.log(JSON.stringify(obj));
updateObjectByPath(obj, "dataStorage.connConfig.host","192.168.1.22");
console.log('After updating...');
console.log(JSON.stringify(obj));
updateObjectByPath(obj, "dataRecorders[0].source.connConfig.host","192.168.1.22");
console.log('After updating...');
console.log(JSON.stringify(obj));