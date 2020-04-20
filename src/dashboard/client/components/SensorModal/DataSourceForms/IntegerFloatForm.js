import React from "react";
import DataSourceForm from "./DataSourceForm";
import { FormNumberItem } from "../../FormItems";

const IntegerFloatForm = ({ dataPath, defaultValue, onChange }) => (
  <React.Fragment>
    <DataSourceForm
      dataPath={dataPath}
      defaultValue={defaultValue}
      onChange={(dPath, v) => onChange(dPath, v)}
      behaviours={[
        "AB_VALUE_OUT_OF_RANGE",
        "AB_VALUE_OUT_OF_REGULAR_RANGE",
        "AB_VALUE_CHANGE_OUT_OF_REGULAR_STEP",
      ]}
    >
      {defaultValue.valueConstraints ? (
        <React.Fragment>
          <FormNumberItem
            label="Min"
            defaultValue={defaultValue.valueConstraints.min}
            onChange={(v) => onChange(`${dataPath}.valueConstraints.min`, v)}
          />
          <FormNumberItem
            label="Max"
            defaultValue={defaultValue.valueConstraints.max}
            onChange={(v) => onChange(`${dataPath}.valueConstraints.min`, v)}
          />
          <FormNumberItem
            label="Init Value"
            min={defaultValue.valueConstraints.min}
            max={defaultValue.valueConstraints.max}
            defaultValue={
              defaultValue.initValue
                ? defaultValue.initValue
                : Math.round(
                    (defaultValue.valueConstraints.min +
                      defaultValue.valueConstraints.max) /
                      2
                  )
            }
            onChange={(v) =>
              onChange(`${dataPath}.initValue`, v)
            }
          />
          <FormNumberItem
            label="Regular Min"
            min={defaultValue.valueConstraints.min}
            max={defaultValue.valueConstraints.max}
            defaultValue={defaultValue.valueConstraints.regularMin}
            onChange={(v) =>
              onChange(`${dataPath}.valueConstraints.regularMin`, v)
            }
          />
          <FormNumberItem
            label="Regular Max"
            min={defaultValue.valueConstraints.min}
            max={defaultValue.valueConstraints.max}
            defaultValue={defaultValue.valueConstraints.regularMax}
            onChange={(v) =>
              onChange(`${dataPath}.valueConstraints.regularMax`, v)
            }
          />
          <FormNumberItem
            label="Step"
            min={defaultValue.valueConstraints.min}
            max={defaultValue.valueConstraints.max}
            defaultValue={defaultValue.valueConstraints.step}
            onChange={(v) => onChange(`${dataPath}.valueConstraints.step`, v)}
          />
        </React.Fragment>
      ) : (
        <FormNumberItem
          label="Init Value"
          defaultValue={defaultValue.initValue}
          onChange={(v) => onChange(`${dataPath}.initValue`, v)}
        />
      )}
    </DataSourceForm>
  </React.Fragment>
);

export default IntegerFloatForm;
