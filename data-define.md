# Data define
## Boolean value
Some sensors provide a boolean value such as: movevement detection, ...
Value: `0` or `1`
```
{ "type": "boolean" }
```
## Enum value
Some sensors provide the value in an pre-defined array such as: level vibration, ...
```
{
	"type": "enum",
	"values": [-5, 6, 2, 10, 12, 40]
}
```

## Integer value
Many sensors provide the value in integer format.
```
{
  "type": "integer", // type of data
  "initValue": "18", // initial value -> can be NULL
  "min": "-273", // minimum value
  "max": "300", // maximum value
  "regular":{ // can be NULL -> the regular value
    "min": "14", // minimum of regular value
    "max": "20", // maximum of regular value
    "step": "2", // maximum different between 2 ajected values.
  },
  "malicious": "abnormal" // abnormal | poisoning | tbd ...
}
```

## Double value
Many sensors provide the value in double format.
```
{
  "type": "double", // type of data
  "initValue":"3.5", // initial value -> can be NULL
  "min": "-10.2", // minimum value
  "max": "10.5", // maximum value
  "regular":{ // can be NULL -> the regular value
    "min": "4.0", // minimum of regular value
    "max": "5.5", // maximum of regular value
    "step": "0.5", // maximum different between 2 ajected values.
  },
  "malicious": "abnormal" // abnormal | poisoning | tbd ...
}
```

## Location GPS
The GPS data
Value:
{
  la: -90 -> 90,
  lo: -180 -> 80
}
```
{
  "type": "location",
  "initValue": { // first position - can be NULL
    "lat": "48.828886",
    "lng": " 2.353675"
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
  "bearingDirection": "180", // The bearing direction (degrees)
  "velo": "5",  // The velocity of the movement (km/h) -> can be NULL
  "malicious": "poisoning" // abnormal | poisoning | tbd ...
}
```
