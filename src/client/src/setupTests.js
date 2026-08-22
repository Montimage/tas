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

