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
      defaultValue={dataSource.devID}
      onChange={(v) => onDataChange(`${dataPath}.devID`, v)}
    />
    <FormTimeRangeItem
      label="Time"
      defaultValue={[dataSource.startTime, dataSource.endTime]}
      onChange={(v) => {
        onDataChange(`${dataPath}.startTime`, v[0]);
        onDataChange(`${dataPath}.endTime`, v[1]);
      }}
    />
  </React.Fragment>
);

export default DataReplayerForm;
