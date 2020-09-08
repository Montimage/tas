import React from "react";

import { FormEditableTextItem } from "../FormItems";
const MongoDBOptions = ({ defaultValue, dataPath, onDataChange }) => (
  <React.Fragment>
    <FormEditableTextItem
      label="User"
      defaultValue={defaultValue.user}
      onChange={(v) => onDataChange(`${dataPath ? `${dataPath}.` : ""}user`, v)}
      placeholder="Username"
      helpText="Username to connect to database"
    />
    <FormEditableTextItem
      label="Password"
      defaultValue={defaultValue.password}
      onChange={(v) =>
        onDataChange(`${dataPath ? `${dataPath}.` : ""}password`, v)
      }
      placeholder="Password"
      helpText="Password to connect to database"
    />
    <FormEditableTextItem
      label="Database"
      defaultValue={defaultValue.dbname}
      onChange={(v) =>
        onDataChange(`${dataPath ? `${dataPath}.` : ""}dbname`, v)
      }
      placeholder="Database name"
      helpText="The database's name to working with"
      rules={[
        {
          required: true,
          message: "Database's name is required!",
        },
      ]}
    />
  </React.Fragment>
);

export default MongoDBOptions;
