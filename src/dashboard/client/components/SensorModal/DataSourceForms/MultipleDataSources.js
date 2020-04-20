import React, { Fragment } from "react";
import BooleanForm from "./BooleanForm";
import EnumForm from "./EnumForm";
import IntegerFloatForm from "./IntegerFloatForm";

const MultipleDataSources = ({ dataPath, sources, onChange }) => (
  <Fragment>
    {sources.map((source, index) => {
      switch (source.type) {
        case "DATA_SOURCE_BOOLEAN":
          return <BooleanForm
            key={index}
            dataPath={`${dataPath}[${index}]`}
            defaultValue={source}
            onChange={(dPath, v) => onChange(dPath, v)}
          />;
        case "DATA_SOURCE_ENUM":
          return <EnumForm
            key={index}
            dataPath={`${dataPath}[${index}]`}
            defaultValue={source}
            onChange={(dPath, v) => onChange(dPath, v)}
          />;
        case "DATA_SOURCE_INTEGER":
        case "DATA_SOURCE_FLOAT":
          return <IntegerFloatForm
            key={index}
            dataPath={`${dataPath}[${index}]`}
            defaultValue={source}
            onChange={(dPath, v) => onChange(dPath, v)}
          />;
        break;
      }
    })}
  </Fragment>
);
export default MultipleDataSources;
