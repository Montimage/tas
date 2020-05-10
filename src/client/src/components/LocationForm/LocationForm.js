import React, { Fragment } from "react";
import { Form, Checkbox, Row, Col } from "antd";
import FormNumberItem from "../FormItems/FormNumberItem";
import FormSelectItem from "../FormItems/FormSelectItem";

const LocationForm = ({dataDescription: { bearingDireaction, velo, initValue, behaviour } , dataPath, onChange}) => (
  <Fragment>
        <Row>
          <Col span={6}>
            <Form.Item>
              <span>Init Value</span>
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item>
              <span>Lat</span>
            </Form.Item>
          </Col>
          <Col span={6}>
            <FormNumberItem
              placeholder="lat"
              min={-90}
              max={90}
              defaultValue={initValue.lat}
              onChange={(v) => onChange(`${dataPath}initValue.lat`, v)}
            />
          </Col>
          <Col span={3}>
            <Form.Item>
              <span>Long</span>
            </Form.Item>
          </Col>
          <Col span={6}>
            <FormNumberItem
              placeholder="long"
              min={-180}
              max={80}
              defaultValue={initValue.lng}
              onChange={(v) => onChange(`${dataPath}initValue.lng`, v)}
            />
          </Col>
        </Row>
        <Row>
          <Col span={6}>
            <Form.Item>
              <span>Bearing Direction</span>
            </Form.Item>
          </Col>
          <Col span={8}>
            <FormNumberItem
              min={-180}
              max={180}
              defaultValue={bearingDireaction}
              placeholder="bearing direaction"
              onChange={(v) => onChange(`${dataPath}bearingDireaction`, v)}
            />
          </Col>
        </Row>
        <Row>
          <Col span={6}>
            <Form.Item>
              <span>Velocity</span>
            </Form.Item>
          </Col>
          <Col span={8}>
            <FormNumberItem
              defaultValue={velo}
              placeholder="velocity (km/h)"
              onChange={(v) => onChange(`${dataPath}velo`, v)}
            />
          </Col>
        </Row>
        <Row>
          <Col span={6}>
            <Form.Item>
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

export default LocationForm;
