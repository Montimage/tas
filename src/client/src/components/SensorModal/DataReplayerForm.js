import React from 'react';
import {
  FormEditableTextItem,
  FormTimeRangeItem,
} from "../FormItems";
import ConnectionConfig from "../ConnectionConfig";

const DataReplayerForm = ({dataPath, dataSource, onDataChange}) => (
  <React.Fragment>
    <ConnectionConfig
      defaultValue={dataSource.connConfig}
      dataPath={`${dataPath}.connConfig`}
      onDataChange={(dPath, v) => onDataChange(dPath, v)}
      type="MONGODB"
    />
    <FormEditableTextItem
      label="sensor-id"
      defaultValue={dataSource.devId}
      onChange={(v) => onDataChange(`${dataPath}.devId`, v)}
      helpText="The id of the sensor whose data will be replayed by current sensor"
      rules = {[
              {
                required: true,
                message: "Replayed device's id is required!"
              }
            ]}
    />
    <FormTimeRangeItem
      label="Time Range"
      defaultValue={[dataSource.startTime ? dataSource.startTime : Date.now(), dataSource.endTime ? dataSource.endTime : Date.now()]}
      onChange={(v) => {
        onDataChange(`${dataPath}.startTime`, v[0]);
        onDataChange(`${dataPath}.endTime`, v[1]);
      }}
      helpText="The time range when the data should be replayed."
    />
  </React.Fragment>
);

export default DataReplayerForm;
