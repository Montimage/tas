import React, { Fragment } from "react";

import CollapseForm from "../CollapseForm";
import {
  FormNumberItem,
  FormEditableTextItem,
  FormParagraphItem,
  FormFileUploadItem,
} from "../FormItems";

const ConnectionConfig = ({ defaultValue, dataPath, onDataChange, type }) => (
  <CollapseForm title="Connection Configuration" bordered={false} active={true}>
    <FormEditableTextItem
      label="Host"
      defaultValue={defaultValue.host}
      onChange={(v) => onDataChange(`${dataPath ? `${dataPath}.` : ""}host`, v)}
      helpText="Host name"
      rules={[
        {
          required: true,
          message: "Host name is required!",
        },
      ]}
    />
    <FormNumberItem
      label="Port"
      min={1023}
      max={65535}
      defaultValue={defaultValue.port}
      onChange={(v) => onDataChange(`${dataPath ? `${dataPath}.` : ""}port`, v)}
      helpText="Port number"
      rules={[
        {
          required: true,
          message: "Port number is required!",
        },
      ]}
    />
    <FormEditableTextItem
      label="User"
      defaultValue={defaultValue.username}
      onChange={(v) =>
        onDataChange(`${dataPath ? `${dataPath}.` : ""}username`, v)
      }
      placeholder="Username"
    />
    <FormEditableTextItem
      label="Password"
      defaultValue={defaultValue.password}
      onChange={(v) =>
        onDataChange(`${dataPath ? `${dataPath}.` : ""}password`, v)
      }
      placeholder="Password"
    />
    {type === "MQTTS" && (
      <Fragment>
        <FormParagraphItem label="CA" value={defaultValue.ca} />
        <FormFileUploadItem
          label="CA file"
          onUpload={(v) => {
            onDataChange(`${dataPath ? `${dataPath}.` : ""}ca`, v);
          }}
        />

        <FormParagraphItem label="Certificate" value={defaultValue.cert} />
        <FormFileUploadItem
          label="Certificate file"
          onUpload={(v) => {
            onDataChange(`${dataPath ? `${dataPath}.` : ""}cert`, v);
          }}
        />
        <FormParagraphItem label="Key" value={defaultValue.key} />
        <FormFileUploadItem
          label="Key file"
          onUpload={(v) => {
            onDataChange(`${dataPath ? `${dataPath}.` : ""}key`, v);
          }}
        />
      </Fragment>
    )}
    {type === "MONGODB" && (
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
