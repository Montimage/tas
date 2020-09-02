import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Table, Menu, Dropdown, Button } from "antd";
import { DownOutlined, DeleteOutlined, CopyOutlined } from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import {
  requestAllTestCases,
  requestAddNewTestCase,
  requestDeleteTestCase,
} from "../actions";

class TestCaseListPage extends Component {

  componentDidMount() {
    this.props.fetchTestCases();
  }

  duplicateTestCase(tc) {
    const newTc = {
      id: `${tc.id}-[duplicated]`,
      name: `${tc.name}-[duplicated]`,
      description: tc.description,
      testCaseIds: tc.testCaseIds,
    };
    this.props.addNewTestCase(newTc);
  }

  render() {
    const { testCases, deleteTestCase } = this.props;
    const dataSource = testCases.map((tc) => ({ ...tc, key: tc.id }));
    const columns = [
      {
        title: "Id",
        key: "data",
        render: (tc) => <a href={`/test-cases/${tc.id}`}> {tc.name} </a>,
      },
      {
        title: "Action",
        key: "data",
        width: 300,
        render: (tc) => (
          <Fragment>
            <Button size="small" style={{marginRight: 10}} onClick={() => this.duplicateTestCase(tc)}><CopyOutlined/> Duplicate</Button>
            <Button size="small" danger onClick={() => deleteTestCase(tc.id)}>
            <DeleteOutlined /> Delete
            </Button>
          </Fragment>
        ),
      },
    ];
    return (
      <LayoutPage
        pageTitle="Test Case"
        pageSubTitle="All the test cases"
      >
        <a href={`/test-cases/new-case-${Date.now()}`}>
          <Button style={{ marginBottom: "10px" }}>Add New Case</Button>
        </a>
        <Table columns={columns} dataSource={dataSource} />
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ testCases }) => ({
  testCases: testCases.allTestCases,
});

const mapDispatchToProps = (dispatch) => ({
  fetchTestCases: () => dispatch(requestAllTestCases()),
  deleteTestCase: (testCaseId) =>
    dispatch(requestDeleteTestCase(testCaseId)),
  addNewTestCase: (testCase) =>
    dispatch(requestAddNewTestCase(testCase)),
});

export default connect(
  mapPropsToStates,
  mapDispatchToProps
)(TestCaseListPage);
