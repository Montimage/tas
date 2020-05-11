import React from 'react';
import {
  FormTextItem,
  FormTimeRangeItem,
} from "../FormItems";
// import DatabaseConfigForm from "../DatabaseConfigForm";
import ConnectionConfig from "../ConnectionConfig";

const DataReplayerForm = ({dataPath, dataSource, onDataChange}) => (
  <React.Fragment>
    <ConnectionConfig
      defaultValue={dataSource.connConfig}
      dataPath={`${dataPath}.connConfig`}
      onDataChange={(dPath, v) => onDataChange(dPath, v)}
      type="MONGODB"
    />
    <FormTextItem
      label="sensor-id"
      defaultValue={dataSource.devId}
      onChange={(v) => onDataChange(`${dataPath}.devId`, v)}
    />
    <FormTimeRangeItem
      label="Time Range"
      defaultValue={[dataSource.startTime ? dataSource.startTime : Date.now(), dataSource.endTime ? dataSource.endTime : Date.now()]}
      onChange={(v) => {
        onDataChange(`${dataPath}.startTime`, v[0]);
        onDataChange(`${dataPath}.endTime`, v[1]);
      }}
    />
  </React.Fragment>
);

export default DataReplayerForm;
