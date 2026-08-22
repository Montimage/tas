import React from "react";
import {
  fireEvent,
  render,
  screen,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { GraphView } from "./GraphView";

const model = {
  name: "home",
  things: [
    {
      id: "t1",
      name: "gateway-1",
      sensors: [{ id: "s1", name: "temp" }],
      actuators: [{ id: "a1", name: "bulb" }],
    },
  ],
};

const renderGraph = (props = {}) => {
  const ref = React.createRef();
  const view = render(
    <GraphView
      ref={ref}
      model={props.model ?? model}
      stats={props.stats ?? []}
      simulationStatus={false}
      requestStats={vi.fn()}
    />
  );
  return { ref, view };
};

afterEach(() => {
  cleanup();
});

describe("GraphView", () => {
  test("renders one group per node and link with the data-count label", () => {
    const { view } = renderGraph();
    expect(view.container.querySelectorAll(".topology-node")).toHaveLength(3);
    const links = view.container.querySelectorAll(".topology-links > g");
    expect(links).toHaveLength(2);
    const labels = Array.from(view.container.querySelectorAll(".topology-links text"));
    expect(labels.map((el) => el.textContent)).toEqual(["0", "0"]);
  });

  test("shows the empty-model fallback when the model has no things", () => {
    const { view } = renderGraph({ model: {} });
    expect(screen.getByText("Empty model")).toBeInTheDocument();
    expect(view.container.querySelector("svg")).toBeNull();
  });

  test("clicking a node selects it and dims non-neighbouring nodes", async () => {
    const { view } = renderGraph();
    const sensorNode = view.container.querySelector('[data-id="t1-s1"]');
    const actuatorNode = view.container.querySelector('[data-id="t1-a1"]');
    fireEvent.click(sensorNode);
    await waitFor(() => {
      expect(sensorNode.getAttribute("opacity")).toBe("1");
    });
    expect(actuatorNode.getAttribute("opacity")).toBe("0.2");
    fireEvent.click(sensorNode);
    await waitFor(() => {
      expect(actuatorNode.getAttribute("opacity")).toBe("1");
    });
  });

  test("dragging a node pins it at the released position and moves its transform", async () => {
    const { ref, view } = renderGraph();
    await waitFor(() => {
      expect(ref.current.simNodes).toHaveLength(3);
    });
    const nodeEl = view.container.querySelector('[data-id="t1"]');
    await waitFor(() => {
      expect(nodeEl.getAttribute("transform")).toBeTruthy();
    });

    const win = nodeEl.ownerDocument.defaultView;
    const dispatchMouse = (target, type, x, y) => {
      const event = new win.MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      });
      // jsdom leaves UIEvent.view null (and its init rejects the proxied
      // window vitest exposes), while d3-drag requires a view with
      // .document; shadow the accessor with the realm's own window.
      Object.defineProperty(event, "view", { value: win });
      target.dispatchEvent(event);
    };

    const draggedAtStart = ref.current.simNodes.find((n) => n.id === "t1");
    const startX = draggedAtStart.x;
    const startY = draggedAtStart.y;

    dispatchMouse(nodeEl, "mousedown", 100, 100);
    dispatchMouse(win, "mousemove", 160, 80);
    dispatchMouse(win, "mouseup", 160, 80);

    const dragged = ref.current.simNodes.find((n) => n.id === "t1");
    // d3-drag reports positions relative to where the node was grabbed.
    expect(dragged.fx).toBeCloseTo(startX + 60, 0);
    expect(dragged.fy).toBeCloseTo(startY - 20, 0);
    await waitFor(() => {
      const [, tx] = /translate\(([-\d.eE]+),/.exec(
        nodeEl.getAttribute("transform")
      );
      expect(Number(tx)).toBeCloseTo(startX + 60, 0);
    });
  });

  test("a stats refresh keeps node positions stable", async () => {
    const { ref, view } = renderGraph();
    await waitFor(() => {
      expect(ref.current.simNodes[0].x).toBeDefined();
    });
    ref.current.simulation.stop();
    const statsWithCounts = [
      {
        id: "t1",
        status: "SIMULATING",
        startedTime: Date.now(),
        lastActivity: Date.now(),
        numberOfSentData: 5,
        numberOfReceivedData: 3,
        sensorStats: [{ id: "s1", numberOfSentData: 5 }],
        actuatorStats: [{ id: "a1", numberOfReceivedData: 3 }],
      },
    ];
    view.rerender(
      <GraphView
        ref={ref}
        model={model}
        stats={statsWithCounts}
        simulationStatus={false}
        requestStats={vi.fn()}
      />
    );
    // syncGraph runs synchronously on the update: every reseeded node must
    // start from the position harvested out of the previous layout.
    for (const node of ref.current.simNodes) {
      const cached = ref.current.positionCache.get(String(node.id));
      expect(node.x).toBe(cached.x);
      expect(node.y).toBe(cached.y);
    }
    const label = view.container.querySelector(".topology-links text");
    expect(label.textContent).toBe("5");
  });
});
