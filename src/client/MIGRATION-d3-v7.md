# d3 5 → 7 upgrade and react-d3-graph retirement — migration guide

Finding `F-DEP-110` (modernization plan task 5.6, issue #78): the topology view
ran on the umbrella `d3` 5.16.0 plus `react-d3-graph` 2.x — the graph library
two majors behind its current line, with a React wrapper that stopped tracking
upstream years ago.

## Starting point (verified before any change)

| Package | Was | Target | Found reality |
|---------|-----|--------|---------------|
| `d3` | `^5.16.0` | `^7.9.0` | Still on 5.16.0; **zero import sites** in dashboard source — it existed only to feed hoisted scoped modules (`d3-selection`, `d3-zoom`, …) to react-d3-graph |
| `react-d3-graph` | `^2.4.1` at filing time | `2.6.0` | Already at 2.6.0 — which is upstream's **final release ever published** (December 2020; dormant since) |

## Why a wrapper swap instead of a version bump

react-d3-graph 2.6.0 cannot consume d3 ≥ 6, so "bump both" has no native
composition point:

- Its `peerDependencies` pin `d3: "^5.5.0"` (and `react: "^16.4.1"`).
- Its compiled runtime reads the `d3.event` global that **d3 6 removed**
  (`lib/components/graph/Graph.js`: `_onDragMove` reads `_d3Selection.event.dx`,
  `_zoomed` reads `_d3Selection.event.transform`). Under the scoped-module
  majors that d3 7 hoists (`d3-selection@3`), both are `undefined` — every node
  drag and wheel/pan over the graph throws.
- Its drag/zoom handlers use the pre-v6 listener signature `(d, i, nodes)`;
  d3-zoom/d3-drag ≥ 2 pass `(event, d)`.

Pinning stale scoped modules to keep the wrapper alive would have left the
executing stack two majors behind (the very finding being closed) while making
the manifest claim otherwise. The topology view therefore renders directly on
d3 7, and react-d3-graph is removed.

## Migration sources

Upstream release notes consulted first (spike step of task 5.6):

- [d3 v6.0.0 release notes](https://github.com/d3/d3/releases/tag/v6.0.0)
- [Official d3 v6 migration guide](https://observablehq.com/@d3/d3v6-migration-guide)
- [d3 v7.0.0 release notes](https://github.com/d3/d3/releases/tag/v7.0.0)

## v5 → v6 breaking changes (relevant subset)

| Change | Impact here |
|--------|-------------|
| **Removed `d3.event`; listeners now receive the event as their first argument** | Primary driver of the rewrite: all event handlers take `(event, d)` |
| Removed `d3.mouse`/`d3.touch(es)`/`d3.clientPoint`; added `d3.pointer(s)` | Drag/zoom positions come from `event.x`/`event.y` supplied by the behaviors themselves |
| Removed `d3-collection`, `d3-voronoi`; iterables accepted broadly | Unused here |

## v6 → v7 breaking changes (relevant subset)

| Change | Impact here |
|--------|-------------|
| **Adopted `type: module`** (ESM-only packaging) | Interacts with the bundler: Vite 7 consumes ESM natively — no interop shims needed (webpack-era concern from the original finding does not apply post-#89) |
| `InternMap` ordinal domains, null-comparison tweaks in `d3.ascending`/`descending` | Unused APIs here |
| Drag/zoom listeners explicitly non-passive where required | Behaviour-neutral; fixes scroll-jank class bugs |

## What changed in this repository

| File | Change |
|------|--------|
| `src/client/package.json` | `d3 ^5.16.0 → ^7.9.0`; `react-d3-graph` removed (with it, the last `react ^16` peer workaround) |
| `src/client/src/components/GraphView/GraphView.js` | Topology rebuilt directly on d3 7: force layout, event-first drag (dropped nodes stay pinned, matching `automaticRearrangeAfterDropNode: false`), zoom with `scaleExtent [minZoom, maxZoom]`, directed arrow markers, link labels, hover/click highlight with neighbour dimming |
| `src/client/src/components/GraphView/GraphConfig.js` | Config slimmed to the keys the new renderer consumes (mapping below); `CustomNode` reused unchanged inside each node group |
| `src/client/src/App.js` | `/graphview` route restored so the view is reachable again (SimulationPage's "View Graph" link had been dead since the component lost its mount point) |
| `src/client/src/components/GraphView/GraphView.test.js` | New: render/drag/select coverage under vitest + jsdom |

### Configuration mapping (old react-d3-graph key → new behaviour)

| Old key | New renderer |
|---------|--------------|
| `directed` | Arrowhead marker on every link when true |
| `width` / `height` | SVG viewport size |
| `minZoom` / `maxZoom` | `d3.zoom().scaleExtent([...])` |
| `highlightDegree` / `highlightOpacity` | Hover/click highlight keeps the active node and its degree-N neighbours opaque, dims the rest |
| `nodeHighlightBehavior` / `linkHighlightBehavior` | Node hover/click and incident-link emphasis implemented via adjacency lookup |
| `node.viewGenerator` | Replaced by direct use of `CustomNode` inside each node's `foreignObject` |
| `link.color` / `strokeWidth` / `highlightColor` | Line styling; highlighted variant when the link touches the active node |
| `link.renderLabel` / `labelProperty` | Link label rendered from `labelProperty(link)` |
| `staticGraph`, `collapsible`, `panAndZoom`, `automaticRearrangeAfterDropNode`, `maxZoom`-adjacent legacy knobs | Dropped — unused combinations of the old defaults; dropped nodes stay pinned exactly as before |

## Verification

- `npm run build` (Vite 7): clean, no ESM interop warnings.
- `npm test` (vitest, jsdom): new `GraphView.test.js` asserts render, drag and
  select behaviour; full client suite green.
- Repository suite (`node --test`) stays at or above the 285/286 baseline.
