import React from "react";

import MongoDBOptions from "./MongoDBOptions";
import CollapseForm from "../CollapseForm";
import { FormNumberItem, FormEditableTextItem } from "../FormItems";

const ConnectionConfig = ({ defaultValue, dataPath, onDataChange, type }) => (
  <CollapseForm title="Connection Configuration" bordered={false} active={true}>
    <FormEditableTextItem
      label="Host"
      defaultValue={defaultValue.host}
      onChange={(v) => onDataChange(`${dataPath ? `${dataPath}.` : ""}host`, v)}
      helpText="Host name"
      rules = {[
              {
                required: true,
                message: "Host name is required!"
              }
            ]}
    />
    <FormNumberItem
      label="Port"
      min={1023}
      max={65535}
      defaultValue={defaultValue.port}
      onChange={(v) => onDataChange(`${dataPath ? `${dataPath}.` : ""}port`, v)}
      helpText="Port number"
      rules = {[
              {
                required: true,
                message: "Port number is required!"
              }
            ]}
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
    <FormEditableTextItem
      label="Options"
      defaultValue={JSON.stringify(defaultValue.options)}
      onChange={(v) =>
        onDataChange(`${dataPath ? `${dataPath}.` : ""}options`, v)
      }
      placeholder="{}"
      helpText="Connection options. Depends on the protocol. It must be in JSON format!"
    />
  </CollapseForm>
);

export default ConnectionConfig;
