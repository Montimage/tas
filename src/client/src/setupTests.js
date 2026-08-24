// jest-dom adds custom matchers for asserting on DOM nodes, wired into
// vitest's expect (the removed `@testing-library/jest-dom/extend-expect`
// path was the jest-dom v4 entry).
import '@testing-library/jest-dom/vitest';

// jsdom gaps that antd's responsive components (Sider breakpoint, Grid)
// rely on at render time.
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Pins antd's responsive components (Grid.useBreakpoint, responsive Col
// spans) to an emulated viewport width for tests that need a specific
// layout, e.g. the collapsed vs horizontal header navigation (issue #41).
// Without it the stub above answers "no" to every query, which is the
// narrow layout. Pass no argument to restore the always-narrow default.
globalThis.setMatchMediaViewport = (width) => {
  if (width === undefined) {
    delete window.matchMedia;
    return;
  }
  window.matchMedia = (query) => {
    const match = /min-width:\s*(\d+)px/.exec(query);
    return {
      matches: match !== null && width >= Number(match[1]),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  };
};

