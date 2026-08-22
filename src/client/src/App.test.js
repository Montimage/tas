import React from "react";
import { createStore, applyMiddleware } from "redux";
import createSagaMiddleware from "redux-saga";
import { Provider } from "react-redux";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import rootReducer from "./reducers";
import rootSaga from "./sagas";

// The api layer is the only boundary the dashboard talks to; mocking it lets
// the real store + sagas run while the network stays out of scope.
const expiry = vi.hoisted(() => ({ handler: null }));

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    requestSession: vi.fn(() => new Promise(() => {})),
    requestAllTestCampaigns: vi.fn(() => Promise.resolve([])),
    requestDevops: vi.fn(() => Promise.resolve({})),
    sendRequestDataRecorderStatus: vi.fn(() => Promise.resolve({})),
    // Capture the subscriber so tests can raise an expiry themselves.
    onSessionExpired: vi.fn((handler) => {
      expiry.handler = handler;
    }),
  };
});

import App from "./App";
import { requestSession } from "./api";

const makeStore = () => {
  const sagaMiddleware = createSagaMiddleware();
  const store = createStore(rootReducer, applyMiddleware(sagaMiddleware));
  sagaMiddleware.run(rootSaga);
  return store;
};

const renderApp = () =>
  render(
    <Provider store={makeStore()}>
      <App />
    </Provider>
  );

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders a loading spinner while the session is being resolved", () => {
    renderApp();
    // `requestSession` never resolves by default, so the app must stay in
    // its checking state instead of guessing at either sign-in view.
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });

  test("shows the sign-in page when there is no session", async () => {
    requestSession.mockResolvedValue({ authenticated: false });
    renderApp();
    // The login form's submit button carries this label.
    expect((await screen.findAllByText("Sign in")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  test("routes to the test-campaign list once signed in", async () => {
    requestSession.mockResolvedValue({ authenticated: true, user: "op" });
    renderApp();
    expect(await screen.findByText("Sign out (op)")).toBeInTheDocument();
    // "/" redirects to /test-campaigns (router v5 -> v7 port).
    expect(await screen.findByText("Test Campaign")).toBeInTheDocument();
  });

  test("raises the session-expiry modal over the current page", async () => {
    requestSession.mockResolvedValue({ authenticated: true, user: "op" });
    renderApp();
    await screen.findByText("Test Campaign");
    // Deliver what the api layer would emit when the server reports 401.
    expect(expiry.handler).toBeTypeOf("function");
    expiry.handler(true);
    expect(await screen.findByText("Your session has expired")).toBeInTheDocument();
    // The routed content stays mounted underneath the modal (the header nav
    // link and the page title both carry this label).
    expect(screen.getAllByText("Test Campaign").length).toBeGreaterThan(0);
  });
});
