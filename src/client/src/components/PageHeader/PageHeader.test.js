import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import PageHeader from "./PageHeader";

describe("PageHeader (local replacement for antd's removed PageHeader)", () => {
  test("renders the title", () => {
    render(<PageHeader title="Connection" />);
    expect(screen.getByText("Connection")).toBeInTheDocument();
  });

  test("renders an optional subtitle", () => {
    render(<PageHeader title="Connection" subTitle="Protocol: MQTT" />);
    expect(screen.getByText("Connection")).toBeInTheDocument();
    expect(screen.getByText("Protocol: MQTT")).toBeInTheDocument();
  });

  test("omits the subtitle element when none is given", () => {
    render(<PageHeader title="Logs" />);
    expect(screen.queryByText(/Protocol:/)).not.toBeInTheDocument();
  });
});
