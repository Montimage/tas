// Installs the Node `process` shim on `window` before any dependency module
// initialises. crypto-browserify and friends call bare `process.nextTick` /
// read `process.version` at import time; webpack injected this shim and Vite
// does not, so the production bundle crashed with "process is not defined"
// (issue #44). This module must be the entry's FIRST import.
import process from "process/browser";

if (typeof window !== "undefined" && typeof window.process === "undefined") {
  window.process = process;
}

export default process;
