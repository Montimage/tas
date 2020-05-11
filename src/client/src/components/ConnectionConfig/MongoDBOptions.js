import React from "react";

import FormTextItem from '../FormItems/FormTextItem';
const MongoDBOptions = ({ defaultValue, dataPath, onDataChange }) => (
  <React.Fragment>
    <FormTextItem
      label="User"
      defaultValue={defaultValue.user}
      onChange={v => onDataChange(`${dataPath ? `${dataPath}.` : ''}user`, v)}
      placeholder="Username"
    />
    <FormTextItem
      label="Password"
      defaultValue={defaultValue.password}
      onChange={v => onDataChange(`${dataPath ? `${dataPath}.` : ''}password`, v)}
      placeholder="Password"
    />
    <FormTextItem
      label="Database"
      defaultValue={defaultValue.dbname}
      onChange={v => onDataChange(`${dataPath ? `${dataPath}.` : ''}dbname`, v)}
      placeholder="Database name"
    />
  </React.Fragment>
);

export default MongoDBOptions;
