import React, { createRef } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import Editor from "./Editor";
import JSONView from "./JSONView";

// A minimal topology shaped like what the model pages feed the editor.
const topology = {
  name: "demo-model",
  nodes: [{ id: 1, label: "gateway" }],
  links: [],
};

const renderEditor = (props = {}) => {
  const ref = createRef();
  const onChange = vi.fn();
  const utils = render(
    <Editor ref={ref} value={topology} onChange={onChange} {...props} />
  );
  return {
    ...utils,
    wrapper: () => ref.current,
    editor: () => ref.current.jsonEditor,
    onChange,
  };
};

describe("JSONView / jsoneditor v10", () => {
  afterEach(cleanup);

  test("loads a topology into a live v10 editor", () => {
    const { container, editor } = renderEditor();
    expect(container.querySelector(".jsoneditor")).toBeInTheDocument();
    // The document really made it through the constructor + set() path.
    expect(editor().get()).toEqual(topology);
    expect(editor().getText()).toContain('"demo-model"');
    expect(screen.getAllByText("demo-model").length).toBeGreaterThan(0);
  });

  test("propagates an edited topology through onChange", () => {
    const { editor, wrapper, onChange } = renderEditor();
    expect(onChange).not.toHaveBeenCalled();

    const edited = { ...topology, name: "renamed-model" };
    // updateText is programmatic, so per the v10 API it does not fire onChange;
    // handleChange is the exact handler user edits invoke, and it must read
    // the edited document back out (the payload ModelPage saves).
    editor().updateText(JSON.stringify(edited));
    wrapper().handleChange();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual(edited);
  });

  test("reports an emptied document to onChange as null", () => {
    const { editor, wrapper, onChange } = renderEditor();
    // Clearing is only legal in text mode; tree mode rejects an empty document.
    editor().setMode("text");
    editor().setText("");
    wrapper().handleChange();
    expect(onChange).toHaveBeenCalledWith(null);
  });

  test("destroys the editor instance on unmount", () => {
    const { editor, unmount } = renderEditor();
    const destroy = vi.spyOn(editor(), "destroy");
    unmount();
    expect(destroy).toHaveBeenCalled();
  });

  test("JSONView wires value and onChange through to the editor", () => {
    const onChange = vi.fn();
    const { container } = render(
      <JSONView value={topology} onChange={onChange} />
    );
    expect(container.querySelector(".jsoneditor")).toBeInTheDocument();
    expect(screen.getAllByText("demo-model").length).toBeGreaterThan(0);
    // Programmatic load alone must not look like a user edit.
    expect(onChange).not.toHaveBeenCalled();
  });
});
