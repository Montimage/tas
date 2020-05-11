import React, { Fragment } from "react";
import { Form, Checkbox, Row, Col } from "antd";
import FormNumberItem from "../FormItems/FormNumberItem";
import FormSelectItem from "../FormItems/FormSelectItem";

const FormNumberWithRange = ({dataDescription: { min, max, initValue, behaviour, regular } , dataPath, onChange}) => (
  <Fragment>
        <Row>
          <Col span={6}>
            <Form.Item shouldUpdate>
              <span>Range</span>
            </Form.Item>
          </Col>
          <Col span={6}>
            <FormNumberItem
              placeholder="min"
              defaultValue={min}
              onChange={(v) => onChange(`${dataPath}min`, v)}
            />
          </Col>
          <Col span={6} push={1}>
            <FormNumberItem
              placeholder="max"
              defaultValue={max}
              onChange={(v) => onChange(`${dataPath}max`, v)}
            />
          </Col>
        </Row>
        <Row>
          <Col span={6}>
            <Form.Item shouldUpdate>
              <span>Init Value</span>
            </Form.Item>
          </Col>
          <Col span={4}>
            <FormNumberItem
              defaultValue={initValue}
              placeholder="initValue"
              onChange={(v) => onChange(`${dataPath}initValue`, v)}
            />
          </Col>
        </Row>
        <Row>
          <Col span={6}>
            <Form.Item shouldUpdate>
              <span>Regular</span>
            </Form.Item>
          </Col>
          <Col span={4}>
            <FormNumberItem
              placeholder="min"
              defaultValue={regular ? regular.min : null}
              onChange={(v) => onChange(`${dataPath}regular.min`, v)}
            />
          </Col>
          <Col span={4} push={1}>
            <FormNumberItem
              placeholder="max"
              defaultValue={regular ? regular.max : null}
              onChange={(v) => onChange(`${dataPath}regular.max`, v)}
            />
          </Col>
          <Col span={4} push={2}>
            <FormNumberItem
              placeholder="step"
              min={0.001}
              max={regular.max - regular.min}
              defaultValue={regular ? regular.step : null}
              onChange={(v) => onChange(`${dataPath}regular.step`, v)}
            />
          </Col>
          <Col span={4} push={3}>
            <Checkbox
              onChange={(v) => {
                if(!v.target.checked) {
                  onChange(`${dataPath}regular`, null);
                }
              }}
              checked={regular ? true : false}
            >Enable</Checkbox>
          </Col>
        </Row>
        <Row>
          <Col span={6}>
            <Form.Item shouldUpdate>
              <span>Behaviour</span>
            </Form.Item>
          </Col>
          <Col span={8}>
            <FormSelectItem
              defaultValue={behaviour}
              onChange={(v) => onChange(`${dataPath}behaviour`, v)}
              options={["Normal", "Abnormal", "Poisoning"]}
            />
          </Col>
        </Row>
      </Fragment>
)

export default FormNumberWithRange;
