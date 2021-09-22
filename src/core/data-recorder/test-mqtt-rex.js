const {checkMQTTTopic} = require('../utils');
var pattern = "100/106/+/+/121/+/101/#";
var pattern2 = '100/108/+/+/121/+/101/#';
var topic = "100/108/0/0/121/100/101/92431440";
console.log(checkMQTTTopic(topic, pattern));
console.log(checkMQTTTopic(topic, pattern2));