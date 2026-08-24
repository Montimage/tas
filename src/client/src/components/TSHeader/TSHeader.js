import React from "react";
import { connect } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { Layout, Menu, Row, Col } from "antd";
import {
  ClusterOutlined, DatabaseOutlined, DeploymentUnitOutlined, InteractionOutlined, FileTextOutlined, FolderOpenOutlined, EyeOutlined, LogoutOutlined,
} from "@ant-design/icons";

import {
  setNotification,
  logout,
} from "../../actions";
import "./styles.css";

const { Header } = Layout;

export const menuLinks = [
  '/test-campaigns',
  '/test-cases',
  '/models',
  '/simulation',
  '/data-recorders',
  '/data-sets',
  '/data-storage',
  '/reports'
];

/**
 * Picks the menu entry for a location pathname.
 *
 * The match is prefix-based but boundary-aware (a link matches only the whole
 * segment it names) and specificity-ordered (the longest matching link wins),
 * so `/test-campaigns/<id>` keeps Test Campaign highlighted while
 * `/logs/test-campaigns` highlights nothing at all. Returns null when no
 * entry matches, e.g. on `/` or any non-section page.
 */
export const selectMenuKey = (pathname) => {
  let selected = null;
  menuLinks.forEach((link, index) => {
    const matches =
      pathname === link || pathname.startsWith(`${link}/`);
    if (matches && (selected === null || link.length > menuLinks[selected].length)) {
      selected = index;
    }
  });
  return selected === null ? null : `${selected}`;
};

const menuIcons = [
  <InteractionOutlined key="icon-0" />,
  <FolderOpenOutlined key="icon-1" />,
  <ClusterOutlined key="icon-2" />,
  <DeploymentUnitOutlined key="icon-3" />,
  <EyeOutlined key="icon-4" />,
  <FileTextOutlined key="icon-5" />,
  <DatabaseOutlined key="icon-6" />,
  <FileTextOutlined key="icon-7" />,
];

const menuNames = [
  'Test Campaign',
  'Test Case',
  'Topology',
  'Simulation',
  'Data Recorder',
  'Data Set',
  'Data Storage',
  'Report',
];

const TSHeader = ({ authenticated, user, logout }) => {
  // The active entry follows the router: useLocation re-renders this header
  // on every client-side navigation (issue #36).
  const { pathname } = useLocation();
  const selectedKey = selectMenuKey(pathname);

  return (
    <Header>
      <Row>
        <Col span={4}>
          <Link to="/">
            <img
              src={'/img/Logo.png'}
              className="logo"
              alt="Logo"
              style={{ maxWidth: "250px", objectFit: "contain" }}
            />
          </Link>
        </Col>
        <Col span={14} push={6}>
          <Menu
            theme="light"
            mode="horizontal"
            style={{ lineHeight: "64px" }}
            selectedKeys={selectedKey ? [selectedKey] : []}
            items={[
              ...menuLinks.map((link, index) => ({
                key: `${index}`,
                label: (
                  <Link to={link}>
                    {menuIcons[index]}
                    {menuNames[index]}
                  </Link>
                ),
              })),
              ...(authenticated
                ? [
                    {
                      key: "logout",
                      label: (
                        <span>
                          <LogoutOutlined />
                          {user ? `Sign out (${user})` : "Sign out"}
                        </span>
                      ),
                      onClick: () => logout(),
                    },
                  ]
                : []),
            ]}
          />
        </Col>
      </Row>

    </Header>
  );
};

const mapPropsToStates = ({ requesting, auth }) => ({
  requesting,
  authenticated: auth.authenticated,
  user: auth.user,
});

const mapDispatchToProps = (dispatch) => ({
  setNotification: ({ type, message }) =>
    dispatch(setNotification({ type, message })),
  logout: () => dispatch(logout()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(TSHeader);
