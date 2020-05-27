import React from "react";
import DataSourceForm from "./DataSourceForm";
import {
  FormNumberItem,
  FormRegularNumberItem,
  FormSwitchItem,
} from "../../FormItems";
import CollapseForm from '../../CollapseForm';
const defaultValueConstraints = {
  min: 0,
  max: 100,
  regularMin: 0,
  regularMax: 100,
  step: 2,
};
const ValueConstraintForm = ({ defaultValue, dataPath, onChange }) => (
  <CollapseForm title={"Value Constraints"}>
    <FormRegularNumberItem
      label="Range"
      items={[
        {
          title: "Min",
          dataPath: `${dataPath}.min`,
          defaultValue: defaultValue.min,
        },
        {
          title: "Max",
          dataPath: `${dataPath}.max`,
          defaultValue: defaultValue.max,
        },
      ]}
      onChange={(dPath, v) => onChange(dPath, v)}
      helpText="The valid value range. For example the humage lifespan can be from 0 - 200"
    />
    <FormRegularNumberItem
      label="Regular Range"
      items={[
        {
          title: "Regular Min",
          dataPath: `${dataPath}.regularMin`,
          defaultValue: defaultValue.regularMin,
        },
        {
          title: "Regular Max",
          dataPath: `${dataPath}.regularMax`,
          defaultValue: defaultValue.regularMax,
        },
        {
          title: "Step",
          dataPath: `${dataPath}.step`,
          defaultValue: defaultValue.step,
        },
      ]}
      onChange={(dPath, v) => onChange(dPath, v)}
      helpText="The regular value range. For example the teenages age can be from 13-19. The step is the maximum different between 2 reports!"
    />
  </CollapseForm>
);

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
      <FormNumberItem
        label="Init Value"
        defaultValue={defaultValue.initValue}
        onChange={(v) => onChange(`${dataPath}.initValue`, v)}
        helpText="Initial value!"
      />
      <FormSwitchItem
        label="Value Constraints"
        onChange={(v) => onChange(`${dataPath}.withValueConstraints`, v)}
        checked={defaultValue.withValueConstraints ? true : false}
        checkedChildren={"Enable"}
        unCheckedChildren={"Disable"}
        helpText="Enable or disable the value constraints specification"
      />
      {defaultValue.withValueConstraints ? (
        defaultValue.valueConstraints ? (
          <ValueConstraintForm
            defaultValue={defaultValue.valueConstraints}
            dataPath={`${dataPath}.valueConstraints`}
            onChange={(dPath, v) => onChange(dPath, v)}
          />
        ) : (
          <ValueConstraintForm
            defaultValue={defaultValueConstraints}
            dataPath={`${dataPath}.valueConstraints`}
            onChange={(dPath, v) => onChange(dPath, v)}
          />
        )
      ) : (
        <React.Fragment></React.Fragment>
      )}
    </DataSourceForm>
  </React.Fragment>
);

export default IntegerFloatForm;
