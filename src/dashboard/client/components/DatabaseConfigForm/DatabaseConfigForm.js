import React from "react";

import FormTextItem from '../FormItems/FormTextItem';
import FormNumberItem from '../FormItems/FormNumberItem';

const DatabaseConfigForm = ({ defaultValue, dataPath, onDataChange }) => (
  <React.Fragment>
    <FormTextItem
      label="Host"
      defaultValue={defaultValue.host}
      onChange={v => onDataChange(`${dataPath ? `${dataPath}.` : ''}host`, v)}
    />
    <FormNumberItem
      label="Port"
      min={1023}
      max={65535}
      defaultValue={defaultValue.port}
      onChange={v => onDataChange(`${dataPath ? `${dataPath}.` : ''}port`, v)}
    />
    <FormTextItem
      label="Database"
      defaultValue={defaultValue.dbname}
      onChange={v => onDataChange(`${dataPath ? `${dataPath}.` : ''}dbname`, v)}
    />
    <FormTextItem
      label="User"
      defaultValue={defaultValue.user}
      onChange={v => onDataChange(`${dataPath ? `${dataPath}.` : ''}user`, v)}
    />
    <FormTextItem
      label="Password"
      defaultValue={defaultValue.password}
      onChange={v => onDataChange(`${dataPath ? `${dataPath}.` : ''}password`, v)}
    />
    <FormTextItem
      label="Options"
      defaultValue={defaultValue.options}
      onChange={v => onDataChange(`${dataPath ? `${dataPath}.` : ''}options`, v)}
    />
  </React.Fragment>
);

export default DatabaseConfigForm;
