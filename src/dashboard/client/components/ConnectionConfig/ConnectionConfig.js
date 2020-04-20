import React from "react";

import FormTextItem from "../FormItems/FormTextItem";
import FormNumberItem from "../FormItems/FormNumberItem";
import MongoDBOptions from "./MongoDBOptions";

const ConnectionConfig = ({ defaultValue, dataPath, onDataChange, type }) => (
  <React.Fragment>
    <FormTextItem
      label="Host"
      defaultValue={defaultValue.host}
      onChange={(v) => onDataChange(`${dataPath ? `${dataPath}.` : ""}host`, v)}
    />
    <FormNumberItem
      label="Port"
      min={1023}
      max={65535}
      defaultValue={defaultValue.port}
      onChange={(v) => onDataChange(`${dataPath ? `${dataPath}.` : ""}port`, v)}
    />
    {type === "MONGODB" && (
      <React.Fragment>
        <MongoDBOptions
          defaultValue={defaultValue}
          dataPath={dataPath}
          onDataChange={onDataChange}
        />
      </React.Fragment>
    )}
    <FormTextItem
      label="Options"
      defaultValue={JSON.stringify(defaultValue.options)}
      onChange={(v) =>
        onDataChange(`${dataPath ? `${dataPath}.` : ""}options`, v)
      }
      placeholder="Connection options in JSON format"
    />
  </React.Fragment>
);

export default ConnectionConfig;
