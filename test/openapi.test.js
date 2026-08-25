/**
 * Published API specification (issue #47).
 *
 * The specification is generated from the mounted routers and the compiled
 * `joi` schemas the `validate` middleware enforces - read off each route's
 * stack, never restated - so it cannot drift from what actually validates a
 * request. These tests pin that guarantee: every mounted endpoint appears,
 * a schema change changes the document, path templates declare their
 * parameters, and what the server serves at /openapi.json is exactly what
 * the generator produces.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Joi = require('joi');

const appModule = require('../src/server/app');
const { buildOpenApiDocument, toOpenApiPath } = require('../src/server/openapi/generate-openapi');
const { toOpenApiSchema } = require('../src/server/openapi/joi-to-openapi');

/** The document as the application itself generates it. */
const buildDocument = () =>
  buildOpenApiDocument({
    mounts: appModule.getApiMounts(),
    version: require('../package.json').version,
  });

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * Independently count every operation across the mounts, walking each router
 * exactly the way Express dispatches - the number the specification must
 * account for.
 */
const expectedOperations = (mounts) => {
  let count = 0;
  for (const { router } of mounts) {
    for (const layer of router.stack || []) {
      if (!layer.route || !layer.route.methods) continue;
      count += METHODS.filter((method) => layer.route.methods[method]).length;
    }
  }
  return count;
};

describe('the generated document', () => {
  const document = buildDocument();

  test('is OpenAPI 3.0 with info and server metadata', () => {
    assert.equal(document.openapi, '3.0.3');
    assert.ok(document.info.title);
    assert.ok(document.info.version);
    assert.deepEqual(document.servers, [{ url: '/' }]);
  });

  test('covers every operation of every mounted router', () => {
    const operations = Object.values(document.paths).reduce(
      (count, pathItem) => count + Object.keys(pathItem).length,
      0
    );
    assert.equal(
      operations,
      expectedOperations(appModule.getApiMounts()),
      'the specification must not miss or invent endpoints'
    );
    assert.equal(Object.keys(document.paths).length, 38);
  });

  test('names well-known endpoints under their real paths', () => {
    for (const template of [
      '/api/health',
      '/api/auth/login',
      '/api/simulation/start',
      '/api/simulation/stop/{fileName}',
      '/api/data-recorders/start',
      '/api/devops',
      '/api/events',
      '/api/logs/simulations/{fileName}',
      '/api/models/{fileName}',
    ]) {
      assert.ok(document.paths[template], `missing documented endpoint: ${template}`);
    }
  });

  test('every operation documents responses, including the shared error shape', () => {
    for (const [template, pathItem] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        assert.ok(operation.responses[200], `${method} ${template} must document success`);
        assert.ok(
          operation.responses[400],
          `${method} ${template} must document validation failure`
        );
        assert.ok(operation.responses[500], `${method} ${template} must document server fault`);
        assert.deepEqual(
          operation.responses[400],
          { $ref: '#/components/responses/ValidationError' },
          'failures reference the one error shape'
        );
      }
    }
  });

  test('session-guarded endpoints document authentication; public ones do not', () => {
    assert.ok(!document.paths['/api/health'].get.responses[401], 'health is public');
    assert.ok(!document.paths['/api/auth/login'].post.responses[401], 'login is public');
    assert.ok(document.paths['/api/simulation/status'].get.responses[401]);
    assert.ok(document.paths['/api/simulation/stats'].get.responses[401]);
  });

  test('every path parameter a template names is declared on each operation', () => {
    for (const [template, pathItem] of Object.entries(document.paths)) {
      const named = [...template.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
      if (named.length === 0) continue;
      for (const [method, operation] of Object.entries(pathItem)) {
        const declared = new Set(
          (operation.parameters || []).filter((p) => p.in === 'path').map((p) => p.name)
        );
        for (const name of named) {
          assert.ok(
            declared.has(name),
            `${method} ${template} must declare path parameter ${name}`
          );
        }
      }
    }
  });

  test('request bodies come from the validating schema, constraints included', () => {
    const start = document.paths['/api/simulation/start'].post.requestBody;
    assert.ok(start, 'simulation start must document its body');
    assert.equal(start.content['application/json'].schema.type, 'object');
    const properties = start.content['application/json'].schema.properties;
    assert.ok(properties.model, 'the model field is part of the contract');
    assert.ok(properties.options, 'the options field is part of the contract');

    // A constraint the schema declares must survive into the document: the
    // stop parameter's filename allowlist comes from fileNameParam().
    const stopParam = document.paths['/api/simulation/stop/{fileName}'].get.parameters.find(
      (parameter) => parameter.name === 'fileName'
    );
    assert.equal(stopParam.required, true);
    assert.ok(stopParam.schema.pattern.includes('\\.json'), 'pattern carries the extension rule');
    assert.ok(stopParam.schema.maxLength > 0);
  });
});

describe('the joi converter', () => {
  test('converts bounds, enums, nullability and defaults', () => {
    const converted = toOpenApiSchema(
      Joi.object({
        page: Joi.number().integer().min(0),
        protocol: Joi.string().valid('MONGODB').required(),
        name: Joi.string().max(64).allow(null, ''),
        limit: Joi.number().positive(),
        tags: Joi.array().items(Joi.string()),
      })
    );
    assert.equal(converted.type, 'object');
    assert.deepEqual(converted.required, ['protocol']);
    assert.equal(converted.properties.page.type, 'integer');
    assert.equal(converted.properties.page.minimum, 0);
    assert.deepEqual(converted.properties.protocol.enum, ['MONGODB']);
    assert.equal(converted.properties.name.maxLength, 64);
    assert.equal(converted.properties.name.nullable, true);
    assert.equal(converted.properties.limit.exclusiveMinimum, 0);
    assert.equal(converted.properties.tags.items.type, 'string');
  });

  test('an unknown construct converts permissively instead of throwing', () => {
    assert.doesNotThrow(() => toOpenApiSchema(Joi.any().meta({ x: 1 })));
    assert.deepEqual(toOpenApiSchema(undefined), {});
  });

  test('express-style parameters become OpenAPI templates', () => {
    assert.equal(toOpenApiPath('/stop/:fileName'), '/stop/{fileName}');
    assert.deepEqual(
      [...toOpenApiPath('/a/:one/b/:two').matchAll(/\{([^}]+)\}/g)].map((m) => m[1]),
      ['one', 'two']
    );
  });
});

describe('publication', () => {
  test('the committed openapi.json matches what the application generates', () => {
    const committed = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'openapi.json'), 'utf8')
    );
    assert.deepEqual(committed, buildDocument(), 'run `npm run spec` after API changes');
  });

  test('GET /openapi.json serves the specification without a session', async () => {
    const http = require('node:http');
    const server = http.createServer(appModule);
    await new Promise((resolve) => server.listen(0, resolve));
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/openapi.json`);
      assert.equal(res.status, 200);
      const served = await res.json();
      assert.equal(served.openapi, '3.0.3');
      assert.ok(served.paths['/api/simulation/start'], 'the served spec documents the API');
      assert.deepEqual(Object.keys(served.paths).sort(), Object.keys(buildDocument().paths).sort());
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
