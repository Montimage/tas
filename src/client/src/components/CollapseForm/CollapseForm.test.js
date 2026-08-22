import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import CollapseForm from "./CollapseForm";

describe("CollapseForm (antd v6 items API)", () => {
  test("renders the header label and the children body", () => {
    render(
      <CollapseForm title="Connection Configuration" active={true}>
        <p>form body</p>
      </CollapseForm>
    );
    expect(screen.getByText("Connection Configuration")).toBeInTheDocument();
    expect(screen.getByText("form body")).toBeInTheDocument();
  });

  test("starts collapsed unless active is set", () => {
    const { container } = render(
      <CollapseForm title="Replay Options">
        <p>hidden body</p>
      </CollapseForm>
    );
    expect(container.querySelector(".ant-collapse-item-active")).toBeNull();
  });
});
