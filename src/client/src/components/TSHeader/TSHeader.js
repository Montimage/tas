import React, { useState } from "react";
import { connect } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { Layout, Menu, Row, Col, Grid, Dropdown } from "antd";
import {
  ClusterOutlined, DatabaseOutlined, DeploymentUnitOutlined, InteractionOutlined, FileTextOutlined, FolderOpenOutlined, EyeOutlined, LogoutOutlined, MenuOutlined,
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

/**
 * Builds the section entries shared by both header layouts (issue #41).
 *
 * Keeping one source means the horizontal menu and the collapsed narrow-screen
 * menu can never drift apart: same links, same labels, same router-driven
 * aria-current marking (issue #36/#39 behaviour).
 */
export const buildSectionItems = (selectedKey) =>
  menuLinks.map((link, index) => ({
    key: `${index}`,
    label: (
      <Link
        to={link}
        aria-current={selectedKey === `${index}` ? "page" : undefined}
      >
        {menuIcons[index]}
        {menuNames[index]}
      </Link>
    ),
  }));

const signOutItem = (authenticated, user, logout) =>
  authenticated
    ? [
        {
          key: "logout",
          icon: <LogoutOutlined />,
          label: user ? `Sign out (${user})` : "Sign out",
          onClick: () => logout(),
        },
      ]
    : [];

/**
 * The collapsed navigation shown below the md breakpoint (issue #41).
 *
 * A real button (keyboard focusable, Enter/Space activates) toggling a
 * Dropdown whose entries are the same sections as the wide layout. antd's
 * dropdown menu moves focus with the arrow keys once open, so the whole
 * collapsed navigation is operable without a pointer.
 */
export const NarrowNav = ({ selectedKey, authenticated, user, logout }) => {
  const [open, setOpen] = useState(false);
  return (
    <Dropdown
      trigger={["click"]}
      onOpenChange={setOpen}
      placement="bottomRight"
      menu={{
        items: [
          ...buildSectionItems(selectedKey),
          ...(signOutItem(authenticated, user, logout).length
            ? [{ type: "divider" }, ...signOutItem(authenticated, user, logout)]
            : []),
        ],
        selectedKeys: selectedKey ? [selectedKey] : [],
      }}
    >
      <button
        type="button"
        className="header-nav-trigger"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MenuOutlined />
        <span>Menu</span>
      </button>
    </Dropdown>
  );
};

const TSHeader = ({ authenticated, user, logout }) => {
  // The active entry follows the router: useLocation re-renders this header
  // on every client-side navigation (issue #36).
  const { pathname } = useLocation();
  const selectedKey = selectMenuKey(pathname);

  // Below the md breakpoint (768px) the eight-item horizontal menu no longer
  // fits beside the logo; it collapses into a dropdown (issue #41).
  // useBreakpoint reports {} before its first matchMedia evaluation, which is
  // treated as wide so the full navigation is never hidden by default.
  const screens = Grid.useBreakpoint();
  const isNarrow = screens.md === false;

  if (isNarrow) {
    return (
      <Header>
        <Row align="middle" justify="space-between">
          <Col span={16}>
            <Link to="/">
              <img src={'/img/Logo.png'} className="logo" alt="TaS dashboard home" />
            </Link>
          </Col>
          <Col span={8} style={{ textAlign: "right" }}>
            <NarrowNav
              selectedKey={selectedKey}
              authenticated={authenticated}
              user={user}
              logout={logout}
            />
          </Col>
        </Row>
      </Header>
    );
  }

  return (
    <Header>
      <Row>
        <Col xs={8} md={4}>
          <Link to="/">
            <img src={'/img/Logo.png'} className="logo" alt="TaS dashboard home" />
          </Link>
        </Col>
        <Col xs={16} md={20} lg={{ span: 14, push: 6 }}>
          <Menu
            theme="light"
            mode="horizontal"
            style={{ lineHeight: "64px" }}
            selectedKeys={selectedKey ? [selectedKey] : []}
            items={[
              ...buildSectionItems(selectedKey),
              ...signOutItem(authenticated, user, logout),
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
