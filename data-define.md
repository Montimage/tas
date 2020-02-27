# Data define
JSON object defines the data of sensor
## Boolean value
Some sensors provide a boolean value such as: movevement detection, ...
Value: `0` or `1`
```json
{ "type": "boolean", "timeInterval":3 }
```
## Enum value
Some sensors provide the value in an pre-defined array such as: level vibration, ...
```json
// Blood glucose level: https://www.healthhub.sg/a-z/diseases-and-conditions/669/blood-glucose-monitoring
{
	"type": "enum",
	"values": ["Excellent", "Good", "Acceptable", "Poor"]
}
```

## Integer value
Many sensors provide the value in integer format.
```json
// Blood pressure value: http://www.bloodpressureuk.org/microsites/u40/Home/facts/Whatisnormal
{
  "type": "integer", // type of data
  "initValue": "100", // initial value -> can be NULL
  "min": "80", // minimum value
  "max": "250", // maximum value
  "regular":{ // can be NULL -> the regular value
    "min": "80", // minimum of regular value
    "max": "120", // maximum of regular value
    "step": "1", // maximum different between 2 ajected values.
  },
  "timeInterval":3,
  "behaviour": "abnormal" // normal | abnormal | poisoning | tbd ...
}
```

## Double value
Many sensors provide the value in double format.
```json
// Scale sensor: kg
{
  "type": "double", // type of data
  "initValue":"54", // initial value -> can be NULL
  "min": "0.5", // minimum value
  "max": "300", // maximum value
  "regular":{ // can be NULL -> the regular value
    "min": "46", // minimum of regular value
    "max": "120", // maximum of regular value
    "step": "0.1", // maximum different between 2 ajected values.
  },
  "timeInterval":3,
  "behaviour": "abnormal" // normal | abnormal | poisoning | tbd ...
}
```

## Location GPS
The GPS data

Latitude range value: `-90 -> 90`
Longtitude range value: `-180 -> 80`

```json
{
  "type": "location",
  "initValue": { // first position - can be NULL
    "lat": "48.828886",
    "lng": "2.353675"
  },
  "limit": { // limitation of the location - can be NULL
    "lat" : {
      "min": "-5.0",
      "max": "10.0",
    },
    "lng": {
      "min": "-15.0",
      "max": "20.0",
    }
  },
  "timeInterval":3,
  "bearingDirection": "180", // The bearing direction (degrees)
  "velo": "5",  // The velocity of the movement (km/h) -> can be NULL
  "behaviour": "poisoning" // normal | abnormal | poisoning | tbd ...
}
```
