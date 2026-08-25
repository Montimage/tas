const { toOpenApiSchema } = require('./joi-to-openapi');

/**
 * Build the API specification from the mounted routers (issue #47).
 *
 * The generator walks the mount manifest the application itself declares -
 * the same array its `app.use` calls iterate - and, for every route in every
 * mounted router, reads the compiled `joi` schemas off the `validate`
 * middleware layer. Nothing about an endpoint's inputs is restated here, so
 * the published specification cannot drift from what actually validates a
 * request: a route added to a router appears the next time this runs, with
 * exactly the constraints its schema declares.
 *
 * Responses are documented from the single error shape every failure takes
 * (`middleware/errors.js`) plus the statuses the shared middleware can answer
 * with; success bodies are described as JSON objects because handler shapes
 * are code, not declared schemas.
 */

/** HTTP methods Express stores on a route, in documentation order. */
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * Convert an Express-style path (`/stop/:fileName`) into an OpenAPI template
 * (`/stop/{fileName}`).
 */
const toOpenApiPath = (value) => value.replace(/:([A-Za-z0-9_]+)/g, (_, name) => `{${name}}`);

/**
 * Collect the parameter names an Express path declares.
 */
const pathParamNames = (value) => {
  const names = [];
  for (const match of value.matchAll(/:([A-Za-z0-9_]+)/g)) names.push(match[1]);
  return names;
};

/**
 * The reusable responses every operation documents: the central error shape
 * plus the statuses the app-wide middleware (authentication, CSRF, rate
 * limiting) can answer with before any handler runs.
 */
const standardResponses = ({ authenticated }) => {
  const responses = {
    400: { $ref: '#/components/responses/ValidationError' },
    // The app-wide rate limiter covers every endpoint, public or not.
    429: { $ref: '#/components/responses/RateLimited' },
    500: { $ref: '#/components/responses/InternalError' },
  };
  if (authenticated) {
    responses[401] = { $ref: '#/components/responses/Unauthorized' };
    // CSRF refusal lands on state-changing requests from an authenticated
    // session that did not echo the token.
    responses[403] = { $ref: '#/components/responses/Forbidden' };
  }
  return responses;
};

/**
 * Describe one operation from its route layer.
 */
const buildOperation = ({ method, validateLayer, authenticated }) => {
  // The compiled schemas live on the middleware function itself (`validate()`
  // publishes them there); the layer merely carries the function.
  const middleware = validateLayer && validateLayer.handle;
  const schemas = (middleware && middleware.validationSchemas) || {};
  const operation = {
    responses: {
      200: {
        description: 'Successful response',
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      ...standardResponses({ authenticated }),
    },
  };

  const parameters = [];
  if (schemas.params) {
    const converted = toOpenApiSchema(schemas.params);
    for (const [name, schema] of Object.entries(converted.properties || {})) {
      parameters.push({
        name,
        in: 'path',
        required: true,
        schema,
      });
    }
  }
  if (schemas.query) {
    const converted = toOpenApiSchema(schemas.query);
    for (const [name, schema] of Object.entries(converted.properties || {})) {
      parameters.push({
        name,
        in: 'query',
        required: Boolean(converted.required && converted.required.includes(name)),
        schema,
      });
    }
  }
  if (parameters.length > 0) operation.parameters = parameters;

  if (schemas.body) {
    const converted = toOpenApiSchema(schemas.body);
    if (converted.properties && Object.keys(converted.properties).length > 0) {
      operation.requestBody = {
        required: Array.isArray(converted.required) && converted.required.length > 0,
        content: { 'application/json': { schema: converted } },
      };
    }
  }

  return operation;
};

/**
 * Walk one router's stack and collect its operations keyed by OpenAPI path.
 *
 * @param {Object} router An Express router
 * @param {String} prefix The path the application mounts it under
 * @param {Object} paths Accumulator mapping OpenAPI paths to operations
 * @param {Object} options
 * @param {Boolean} options.publicRouter Endpoints here answer without a session
 */
const collectRouterPaths = (router, prefix, paths, options) => {
  for (const layer of router.stack || []) {
    if (!layer.route || !layer.route.path || !layer.route.methods) continue;
    const expressPath = `${prefix}${layer.route.path === '/' ? '' : layer.route.path}`;
    const openApiPath = toOpenApiPath(expressPath);
    // Find this route's validation layer by name: `validate()` returns a
    // function named `validateRequest` carrying its compiled schemas.
    const validateLayer = (layer.route.stack || []).find(
      (entry) => entry.handle && entry.handle.name === 'validateRequest'
    );

    for (const method of METHODS) {
      if (!layer.route.methods[method]) continue;
      // eslint-disable-next-line no-param-reassign
      paths[openApiPath] = paths[openApiPath] || {};
      // Every operation gets at least the standard success/error envelope;
      // a declared schema adds its inputs on top.
      // eslint-disable-next-line no-param-reassign
      paths[openApiPath][method] = buildOperation({
        method,
        validateLayer,
        authenticated: !options.publicRouter,
      });
    }
  }
};

/**
 * Assemble the whole document.
 *
 * @param {Object} options
 * @param {Array<{prefix: String, router: Object, public?: Boolean}>} options.mounts
 *   The application's own mount declarations, in mounting order
 * @param {String} [options.title]
 * @param {String} [options.version]
 * @param {String} [options.serverUrl]
 * @returns {Object} An OpenAPI 3.0 document
 */
const buildOpenApiDocument = ({
  mounts,
  title = 'TaS API',
  version = '1.0.0',
  serverUrl = '/',
}) => {
  const paths = {};
  for (const { prefix, router, public: publicRouter } of mounts) {
    collectRouterPaths(router, prefix, paths, { publicRouter: Boolean(publicRouter) });
  }

  // OpenAPI requires every `{param}` a template names to be declared per
  // operation. An endpoint whose schema did not declare one of its own path
  // parameters still gets an honest (unconstrained) string entry rather than
  // a document that fails validation.
  for (const [template, operations] of Object.entries(paths)) {
    for (const op of Object.values(operations)) {
      const declared = new Set(
        (op.parameters || []).filter((p) => p.in === 'path').map((p) => p.name)
      );
      const missing = pathParamNames(template).filter((name) => !declared.has(name));
      if (missing.length === 0) continue;
      // eslint-disable-next-line no-param-reassign
      op.parameters = (op.parameters || []).concat(
        missing.map((name) => ({ name, in: 'path', required: true, schema: { type: 'string' } }))
      );
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title,
      description:
        'Test and Simulation Enabler API. Generated from the request validation schemas the server enforces, so it cannot drift from the implementation.',
      version,
    },
    servers: [{ url: serverUrl }],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'A caller-safe failure message.' },
            details: {
              type: 'array',
              description: 'Per-field breakdown, carried by validation failures.',
              items: {
                type: 'object',
                properties: {
                  location: { type: 'string', enum: ['params', 'query', 'body'] },
                  field: { type: 'string' },
                  message: { type: 'string' },
                  type: { type: 'string' },
                },
              },
            },
          },
          required: ['error'],
        },
      },
      responses: {
        ValidationError: {
          description: 'The request was malformed or failed validation.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
          },
        },
        Unauthorized: {
          description: 'No session, or it has expired.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
          },
        },
        Forbidden: {
          description: 'The session may not do this (missing CSRF token, disallowed origin).',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
          },
        },
        NotFound: {
          description: 'The addressed resource does not exist.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
          },
        },
        Conflict: {
          description: 'The request cannot be applied to the current resource state.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
          },
        },
        RateLimited: {
          description: 'Too many requests from this client; retry later.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
          },
        },
        InternalError: {
          description: 'An unclassified server-side failure.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
          },
        },
      },
    },
    paths,
  };
};

module.exports = { buildOpenApiDocument, toOpenApiPath, pathParamNames };
