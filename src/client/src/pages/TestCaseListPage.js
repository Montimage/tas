import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Table, Button, Popconfirm } from "antd";
import { DeleteOutlined, CopyOutlined } from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import { ListStateEmpty, ListStateError } from "../components/ListStates";
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
    const {
      testCases,
      deleteTestCase,
      requesting,
      requestError,
      fetchTestCases,
    } = this.props;
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
            <Popconfirm
              title={`Delete test case "${tc.id}"?`}
              description="This permanently removes the test case. It cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
              onConfirm={() => deleteTestCase(tc.id)}
            >
              <Button size="small" danger>
                <DeleteOutlined /> Delete
              </Button>
            </Popconfirm>
          </Fragment>
        ),
      },
    ];
    const emptyState =
      !requesting && requestError ? (
        <ListStateError
          message={requestError.message}
          onRetry={fetchTestCases}
        />
      ) : (
        <ListStateEmpty
          description="No test cases yet"
          action={
            <a href={`/test-cases/new-case-${Date.now()}`}>
              <Button type="primary">Add New Case</Button>
            </a>
          }
        />
      );
    return (
      <LayoutPage
        pageTitle="Test Case"
        pageSubTitle="All the test cases"
      >
        <a href={`/test-cases/new-case-${Date.now()}`}>
          <Button style={{ marginBottom: "10px" }}>Add New Case</Button>
        </a>
        <Table columns={columns} dataSource={dataSource} locale={{ emptyText: emptyState }} />
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ testCases, requesting, requestError }) => ({
  testCases: testCases.allTestCases,
  requesting,
  requestError,
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
