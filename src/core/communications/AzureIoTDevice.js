// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// 'use strict';

// The device connection string to authenticate the device with your IoT hub.
//
// NOTE:
// For simplicity, this sample sets the connection string in code.
// In a production environment, the recommended approach is to use
// an environment variable to make it available to your application
// or use an HSM or an x509 certificate.
// https://docs.microsoft.com/azure/iot-hub/iot-hub-devguide-security
//
// Using the Azure CLI:
// az iot hub device-identity show-connection-string --hub-name {YourIoTHubName} --device-id MyNodeDevice --output table
const Mqtt = require('azure-iot-device-mqtt').Mqtt;
const DeviceClient = require('azure-iot-device').Client;
const Message = require('azure-iot-device').Message;

class AzureIoTDevice {
  constructor({host, deviceId, shareAccessKey}) {
    this.hostname = host;
    this.deviceId = deviceId;
    this.shareAccessKey = shareAccessKey;
    this.client = null;
  }

  connect(callback = null) {
    const connectionString = `HostName=${this.hostname}.azure-devices.net;DeviceId=${this.deviceId};SharedAccessKey=${this.shareAccessKey}`;
    console.log(`Connection String: ${connectionString}`);
    this.client = DeviceClient.fromConnectionString(connectionString, Mqtt);
    if (callback) return callback();
  }

  publish(data) {
    const message = new Message(JSON.stringify(data));
    this.client.sendEvent(message, function (err) {
      if (err) {
        console.error(`[AzureIoTDevice] Send error: ${err.toString()}`);
      } else {
        console.log(`[AzureIoTDevice] Message sent!!!`);
      }
    });
  }

  close() {

  }
}

module.exports = AzureIoTDevice;

// // Using the Node.js Device SDK for IoT Hub:
// //   https://github.com/Azure/azure-iot-sdk-node
// // The sample connects to a device-specific MQTT endpoint on your IoT Hub.



// // Create a message and send it to the IoT hub every second
// setInterval(function(){
//   // Simulate telemetry.
//   var temperature = 20 + (Math.random() * 15);
//   var message = new Message(JSON.stringify({
//     temperature: temperature,
//     humidity: 60 + (Math.random() * 20)
//   }));

//   // Add a custom application property to the message.
//   // An IoT hub can filter on these properties without access to the message body.
//   message.properties.add('temperatureAlert', (temperature > 30) ? 'true' : 'false');

//   console.log('Sending message: ' + message.getData());

//   // Send the message.
//   client.sendEvent(message, function (err) {
//     if (err) {
//       console.error('send error: ' + err.toString());
//     } else {
//       console.log('message sent');
//     }
//   });
// }, 1000);
