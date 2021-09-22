const mqtt = require("mqtt");
const fs = require("fs");
const path = require("path");

const centralGWTopics = [
  "100/100/+/+/121/+/101/#",
  "100/101/+/+/121/+/101/#",
  "100/102/+/+/121/+/101/#",
  "100/106/+/+/121/+/101/#",
  "100/108/+/+/121/+/101/#",
  "100/999/+/+/121/+/101/#",
  "101/100/+/+/121/+/101/#",
  "101/103/+/+/121/+/101/#",
  "101/999/+/+/121/+/101/#",
  "102/100/+/+/121/+/101/#",
  "102/101/+/+/121/+/101/#",
  "102/102/+/+/121/+/101/#",
  "102/103/+/+/121/+/101/#",
  "102/119/+/+/121/+/101/#",
  "102/120/+/+/121/+/101/#",
  "102/999/+/+/121/+/101/#",
  "103/101/+/+/121/+/101/#",
  "103/102/+/+/121/+/101/#",
  "103/999/+/+/121/+/101/#",
];

const partnersGWTopics = [
  "100/100/+/+/121/+/101/#",
  "100/101/+/+/121/+/101/#",
  "100/102/+/+/121/+/101/#",
  "100/106/+/+/121/+/101/#",
  "100/108/+/+/121/+/101/#",
  "100/999/+/+/121/+/101/#",
  "101/100/+/+/121/+/101/#",
  "101/103/+/+/121/+/101/#",
  "101/999/+/+/121/+/101/#",
  "102/100/+/+/121/+/101/#",
  "102/101/+/+/121/+/101/#",
  "102/102/+/+/121/+/101/#",
  "102/103/+/+/121/+/101/#",
  "102/119/+/+/121/+/101/#",
  "102/120/+/+/121/+/101/#",
  "102/999/+/+/121/+/101/#",
  "103/101/+/+/121/+/101/#",
  "103/102/+/+/121/+/101/#",
  "103/999/+/+/121/+/101/#",
];

const rcaSubTopics = [
  "109/101/+/+/500/+/101/#"
];

const rcaPubTopics = ["109/102/0/0/124/100/100/#"];

const ALL_TOPICS = "#";

const centralGWPort = 8886;

const partnersGWPort = 8884;

// Central GW publish
const centralPubTopic = "100/106/0/0/121/100/101/92431440/1940593378";
const centralPubMessage = [
  {
    ServiceID: 100106,
    Root: { Gateway: 1000501, Source: 0, TimeStamp: 1608200609 },
    Nodes: [
      {
        Safety: "true",
        NodeID: 1,
        TimeStamp: 1608200609,
        TimeAccuracy: 46308279,
        "Sensors-Actuators": [
          {
            SensorID: 3313,
            TimeStamp: 1608200609,
            TimeAccuracy: 46308279,
            Resources: {
              "5701": "m/s2",
              "5702": -23,
              "5703": 387,
              "5704": 1184,
            },
          },
          {
            SensorID: 3336,
            TimeStamp: 1608200609,
            TimeAccuracy: 46308279,
            Resources: {
              "5513": "0.000000",
              "5514": "0.000000",
              "5515": "0.000000",
              "5518": 6846708,
            },
          },
          {
            SensorID: 3300,
            TimeStamp: 1608200609,
            TimeAccuracy: 46308279,
            Resources: { "5700": 0, "5701": "dBi" },
          },
        ],
        CRC: 1661796109,
      },
      {
        Safety: "true",
        NodeID: 2,
        TimeStamp: 1608200608,
        TimeAccuracy: 827000856,
        "Sensors-Actuators": [
          {
            SensorID: 3313,
            TimeStamp: 1608200608,
            TimeAccuracy: 827000856,
            Resources: {
              "5701": "m/s2",
              "5702": 15,
              "5703": -21,
              "5704": 1200,
            },
          },
          {
            SensorID: 3336,
            TimeStamp: 1608200608,
            TimeAccuracy: 827000856,
            Resources: {
              "5513": "0.000000",
              "5514": "0.000000",
              "5515": "0.000000",
              "5518": 6847213,
            },
          },
          {
            SensorID: 3300,
            TimeStamp: 1608200608,
            TimeAccuracy: 827000856,
            Resources: { "5700": -36, "5701": "dBi" },
          },
        ],
        CRC: 2280414272,
      },
      {
        Safety: "true",
        NodeID: 3,
        TimeStamp: 1608200608,
        TimeAccuracy: 997065782,
        "Sensors-Actuators": [
          {
            SensorID: 3313,
            TimeStamp: 1608200608,
            TimeAccuracy: 997065782,
            Resources: {
              "5701": "m/s2",
              "5702": -34,
              "5703": -73,
              "5704": 1184,
            },
          },
          {
            SensorID: 3336,
            TimeStamp: 1608200608,
            TimeAccuracy: 997065782,
            Resources: {
              "5513": "0.000000",
              "5514": "0.000000",
              "5515": "0.000000",
              "5518": 6847492,
            },
          },
          {
            SensorID: 3300,
            TimeStamp: 1608200608,
            TimeAccuracy: 997065782,
            Resources: { "5700": -43, "5701": "dBi" },
          },
        ],
        CRC: 1144300382,
      },
    ],
    CRC: 71785975,
  },
];

// Partner GW publish
const partnersPubTopic = "100/108/0/0/121/100/101/3971200846/2909112117";
const partnersPubMessage = {
  ServiceID: 100108,
  Root: { Gateway: 1000501, Source: 0, TimeStamp: 1608199369 },
  Nodes: [
    {
      Safety: "true",
      NodeID: 1,
      TimeStamp: 1608199369,
      TimeAccuracy: 72165250,
      "Sensors-Actuators": [
        {
          SensorID: 3342,
          TimeStamp: 1608199369,
          TimeAccuracy: 72165250,
          Resources: { "5500": "true" },
        },
      ],
      CRC: 44210609,
    },
    {
      Safety: "true",
      NodeID: 2,
      TimeStamp: 1608199368,
      TimeAccuracy: 860842943,
      "Sensors-Actuators": [
        {
          SensorID: 3342,
          TimeStamp: 1608199368,
          TimeAccuracy: 860842943,
          Resources: { "5500": "true" },
        },
      ],
      CRC: 1996563590,
    },
    {
      Safety: "true",
      NodeID: 3,
      TimeStamp: 1608199369,
      TimeAccuracy: 27014017,
      "Sensors-Actuators": [
        {
          SensorID: 3342,
          TimeStamp: 1608199369,
          TimeAccuracy: 27014017,
          Resources: { "5500": "true" },
        },
      ],
      CRC: 3658498615,
    },
  ],
  CRC: 3838416492,
};

const start = (port, subTopics, pubTopic, pubMessage) => {
  const connConfig = {
    host: "34.255.17.2",
    port,
    username: "lnguyen",
    password: "Enact2019",
    rejectUnauthorized: false,
    ca: fs.readFileSync(
      "/home/montimage/enact/indra-certs/Public-ca-chain.cert.pem"
    ),
    cert: fs.readFileSync("/home/montimage/enact/indra-certs/lnguyen.cert.pem"),
    key: fs.readFileSync("/home/montimage/enact/indra-certs/lnguyen.key.pem"),
    // ca: fs.readFileSync(path.join(__dirname,'indra-certs/Public-ca-chain.cert.pem')),
    // cert: fs.readFileSync(path.join(__dirname,'indra-certs/lnguyen.cert.pem')),
    // key: fs.readFileSync(path.join(__dirname,'indra-certs/lnguyen.key.pem')),
    protocol: "mqtts",
  };

  const client = mqtt.connect(connConfig);

  client.on("message", function (topic, message) {
    console.log("---");
    console.log(topic);
    console.log(message.toString());
  });

  client.on("connect", function () {
    console.log("Connected");
    if (process.argv[3] === "sub") {
      let topics = subTopics;
      if (process.argv[4] === "all") {
        topics = ALL_TOPICS;
      } else if (process.argv[4] === "rca") {
        topics = rcaSubTopics;
      }

      console.log("Subscribing ....");
      for (let index = 0; index < topics.length; index++) {
        const topic = topics[index];
        console.log("Subscribed topic: ", topic);
        client.subscribe(topic);
      }
    } else if (process.argv[3] === "pub") {
      console.log("Going to publish a message");
      console.log(pubTopic);
      console.log(pubMessage);

      client.publish(pubTopic, JSON.stringify(pubMessage), null, (err) => {
        console.error("Something wrong????");
        console.error(err);
      });
    } else {
      console.error("No action has been selected");
    }
  });

  client.on("error", function (err) {
    console.error("[ERROR] Cannot connect to MQTT-BROKER\n", err);
  });
};

// Start the testing app

if (process.argv[2] === "central") {
  console.log("Working with Central GW: ", centralGWPort);
  start(centralGWPort, centralGWTopics, centralPubTopic, centralPubMessage);
} else if (process.argv[2] === "partners") {
  console.log("Working with Partners GW", partnersGWPort);
  start(partnersGWPort, partnersGWTopics, partnersPubTopic, partnersPubMessage);
} else {
  console.error("Unsupported GW: ", process.argv[2]);
}
