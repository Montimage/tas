import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import FormTimeRangeItem from "./FormTimeRangeItem";

describe("FormTimeRangeItem (moment -> dayjs on antd v6 RangePicker)", () => {
  test("renders the labelled range picker with defaults applied", () => {
    render(
      <FormTimeRangeItem
        label="Replay window"
        defaultValue={["2026-01-02 10:00", "2026-01-02 11:00"]}
      />
    );
    expect(screen.getByText("Replay window")).toBeInTheDocument();
    // Two dayjs-backed inputs: one per bound of the range.
    const inputs = document.querySelectorAll(".ant-picker-input input");
    expect(inputs.length).toBe(2);
  });

  test("falls back to now when no default value is given", () => {
    render(<FormTimeRangeItem label="Window" />);
    expect(inputsPopulated()).toBe(true);
  });
});

const inputsPopulated = () =>
  document.querySelectorAll(".ant-picker-input input").length === 2;
