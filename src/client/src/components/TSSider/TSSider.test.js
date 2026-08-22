import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import TSSider from "./TSSider";

describe("TSSider (antd v6 Menu items API)", () => {
  test("renders one entry per item, with links where given", () => {
    const items = [
      { key: "1", icon: <span>i</span>, text: "Topology", href: "/models" },
      {
        key: "2",
        icon: <span>s</span>,
        text: "Simulation",
        action: () => {},
      },
      { key: "3", icon: <span>d</span>, text: "Plain" },
    ];
    render(<TSSider defaultKey="1" items={items} />);
    expect(screen.getByText("Topology")).toBeInTheDocument();
    expect(screen.getByText("Simulation")).toBeInTheDocument();
    const link = screen.getByText("Topology").closest("a");
    expect(link).toHaveAttribute("href", "/models");
  });
});
