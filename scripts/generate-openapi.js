#!/usr/bin/env node
/**
 * Generate the published API specification (issue #47).
 *
 * Requires the real application - the same routers, mounted the same way the
 * server runs them - and writes the OpenAPI 3.0 document to docs/openapi.json.
 * Run it after changing any endpoint or schema:
 *
 *   npm run spec
 *
 * The served document (GET /openapi.json) is produced by the same generator
 * from the same mounts at process start; this script exists so the committed
 * copy integrators read stays current without running the server.
 */
const fs = require('fs');
const path = require('path');

const appModule = require('../src/server/app');
const { buildOpenApiDocument } = require('../src/server/openapi/generate-openapi');

const document = buildOpenApiDocument({
  mounts: appModule.getApiMounts(),
  version: require('../package.json').version,
});

// The repo root, deliberately: `docs/` is gitignored in this repository, and
// the published specification must be tracked so a PR that changes the API
// visibly changes the spec with it.
const outPath = path.join(__dirname, '..', 'openapi.json');
fs.writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);

const operations = Object.values(document.paths).reduce(
  (count, pathItem) => count + Object.keys(pathItem).length,
  0
);
console.log(
  `[SPEC] Wrote ${outPath} (${Object.keys(document.paths).length} paths, ${operations} operations)`
);
