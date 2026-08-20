const Joi = require('joi');
const { NAME_MAX_LENGTH } = require('../routes/path-safety');
const { badRequest } = require('./errors');

/**
 * Request sections that carry externally controlled input, with the validation
 * options each one is checked under.
 *
 * `query` is *stripped* of everything the schema does not declare, so a value
 * no schema names cannot reach a handler or a database filter even by
 * accident. `params` and `body` reject undeclared keys instead, because there
 * silently dropping a field would hide a genuine caller mistake — and because
 * rejecting `$`-prefixed keys is what keeps MongoDB operators out of update
 * documents (see `documentSchema`).
 */
const SECTIONS = [
  { key: 'params', options: { abortEarly: false, convert: true } },
  { key: 'query', options: { abortEarly: false, stripUnknown: true, convert: true } },
  { key: 'body', options: { abortEarly: false, convert: true } },
];

/**
 * What a section is validated against when the endpoint declares nothing for
 * it: an object with no permitted keys. An endpoint that declares no query
 * string accepts none, rather than passing whatever arrives on to its handler.
 */
const NOTHING_DECLARED = {};

/**
 * Accept either a compiled Joi schema or a plain map of field name to schema.
 *
 * Declaring `{ fileName: Joi.string() }` at a call site reads better than
 * `Joi.object({ fileName: Joi.string() })`, and compiling here means a route
 * cannot accidentally hand the middleware a value it silently cannot use.
 *
 * @param {Object|Joi.Schema} schema The declared schema
 * @returns {Joi.Schema} A compiled Joi schema
 */
const compileSchema = (schema) => (Joi.isSchema(schema) ? schema : Joi.compile(schema));

/**
 * Validate request parameters, query string and body against declared schemas.
 *
 * Every endpoint that accepts external input declares its schema here, and the
 * declared schema is the only thing that decides whether a request is well
 * formed: values that do not match their declared type are rejected before the
 * handler — and therefore before any database call — runs.
 *
 * This is what stops a query parameter that is declared as a string from
 * arriving as a structured object. Express's default query parser turns
 * `?datasetId[$ne]=x` into `{ datasetId: { $ne: 'x' } }`, which flows into a
 * Mongo filter and changes the meaning of the query; `Joi.string()` rejects the
 * object outright, so the handler only ever sees the declared type.
 *
 * The validated (and type-converted) value replaces the raw one on the request,
 * so handlers read exactly what the schema allowed and nothing else. A section
 * the endpoint does not declare is validated against an empty schema, so
 * `validate()` with no arguments is a positive statement that the endpoint
 * takes no input at all.
 *
 * @param {Object} schemas
 * @param {Object|Joi.Schema} [schemas.params]  Schema for URL parameters
 * @param {Object|Joi.Schema} [schemas.query]   Schema for the query string
 * @param {Object|Joi.Schema} [schemas.body]    Schema for the request body
 * @returns {Function} Express middleware
 */
const validate = (schemas = {}) => {
  const compiled = SECTIONS.map(({ key, options }) => ({
    key,
    options,
    schema: compileSchema(
      schemas[key] === undefined || schemas[key] === null ? NOTHING_DECLARED : schemas[key]
    ),
  }));

  // Named so a route's middleware stack can be inspected for it: the test
  // suite asserts every endpoint declares a schema by looking for this layer.
  return function validateRequest(req, res, next) {
    const details = [];
    const validated = [];

    for (const { key, options, schema } of compiled) {
      const { error, value } = schema.validate(req[key], options);
      if (error) {
        for (const detail of error.details) {
          details.push({
            location: key,
            // A failure on the section itself (a missing body, say) has an
            // empty path; name the section so every entry names a field.
            field: detail.path.length > 0 ? detail.path.join('.') : key,
            message: detail.message,
            type: detail.type,
          });
        }
      } else {
        validated.push({ key, value });
      }
    }

    if (details.length > 0) {
      // Handed to `next` rather than answered here, so a rejected request is
      // rendered by the same handler as every other failure and the API keeps
      // one error shape (`middleware/errors.js`).
      return next(badRequest('Validation failed', details));
    }

    for (const { key, value } of validated) {
      req[key] = value;
    }

    return next();
  };
};

/**
 * Keys that would be read as MongoDB operators if the value reached a query or
 * an update document: `$`-prefixed names, and dotted names that address a
 * nested path.
 */
const MONGO_OPERATOR_KEY = /^\$|\./;

/**
 * Schema for a document that round-trips through the database.
 *
 * Persisted documents come back carrying fields the API never declared (`_id`,
 * `__v`, timestamps), and the dashboard sends them straight back on update, so
 * unknown keys are tolerated. Operator keys are not: `{ $set: ... }` and
 * `{ $ne: ... }` are the shapes that turn an update or a filter into something
 * the caller never should have been able to express.
 *
 * The rule applies to the document's *own* keys and does not recurse. `{ $ne:
 * 1 }` and `{ "a.b": 1 }` are rejected on the document itself, but a field
 * declared as a bare `Joi.object()` — `event.values`, the evaluation
 * parameters — still accepts `{ $ne: 1 }` one level down. That is deliberate,
 * and it is sufficient for the sinks this codebase actually has: the update
 * filters are `{ _id }` and `{ id }`, built from declared scalars, and an
 * operator key nested inside a free-form value is written as a literal field
 * name rather than interpreted as an operator. Making the rule recursive would
 * change how those free-form payloads validate, so it is out of scope here —
 * a field that does reach a filter is declared with its own type instead.
 *
 * @param {Object} keys Declared fields of the document
 * @returns {Joi.Schema}
 */
const documentSchema = (keys) =>
  Joi.object(keys).pattern(MONGO_OPERATOR_KEY, Joi.any().forbidden()).unknown(true);

/**
 * Schema for a name that is used to derive a filename on disk.
 *
 * Deliberately the same allowlist and the same length cap as
 * `routes/path-safety.js`: a name that this schema accepts is a name that
 * containment will also accept, so the two never disagree about what is safe.
 */
const safeNameSchema = Joi.string()
  .pattern(/^[A-Za-z0-9][A-Za-z0-9 _\-.()[\]+@'#]*$/)
  .max(NAME_MAX_LENGTH)
  .messages({
    'string.pattern.base':
      '{{#label}} must start with an alphanumeric character and contain only safe characters',
    'string.max': '{{#label}} must not exceed {{#limit}} characters',
  });

/**
 * The longest a filename derived from a name may be.
 *
 * A stored file is named `${name}${extension}`, so it is always longer than the
 * name it was derived from. Capping the filename at `NAME_MAX_LENGTH` too would
 * accept a name on the write path and then reject the very filename that write
 * produced, leaving a file on disk that no route could read, update or delete.
 * The two caps are counted against different strings and must differ by exactly
 * the extension.
 *
 * @param {String} extension Extension including the dot, e.g. `.json`
 * @returns {Number} Maximum length of the derived filename
 */
const fileNameMaxLength = (extension) => NAME_MAX_LENGTH + extension.length;

/**
 * Width of the millisecond timestamp the product interpolates into the file
 * names it generates. Derived from `Date.now()` rather than written as a
 * literal so it cannot drift from the value actually being interpolated.
 */
const TIMESTAMP_LENGTH = String(Date.now()).length;

/**
 * The longest a *generated* file name may be.
 *
 * Log files are named `${name}_${Date.now()}${extension}` by the simulation,
 * data recorder and devops flows, so they are longer than a plain derived
 * filename by a separator and a timestamp. Holding those routes to
 * `fileNameMaxLength` would reject the very names the server itself wrote —
 * the same defect the name/filename split above exists to prevent, one step
 * further along.
 *
 * @param {String} extension Extension including the dot, e.g. `.log`
 * @returns {Number} Maximum length of the generated file name
 */
const generatedFileNameMaxLength = (extension) =>
  fileNameMaxLength(extension) + '_'.length + TIMESTAMP_LENGTH;

/**
 * Build a schema for a filename parameter with a fixed extension.
 *
 * @param {String} extension Extension including the dot, e.g. `.json`
 * @param {Number} [maxLength] Cap for names this route serves, when the route
 *                             addresses generated names rather than names
 *                             derived directly from a user-supplied one
 * @returns {Joi.Schema}
 */
const fileNameParam = (extension, maxLength = fileNameMaxLength(extension)) =>
  Joi.string()
    .pattern(new RegExp(`^[A-Za-z0-9][A-Za-z0-9 _\\-.()\\[\\]+@'#]*\\${extension}$`))
    .max(maxLength)
    .required()
    .messages({
      'string.pattern.base': `{{#label}} must be a safe ${extension} file name`,
      'string.max': '{{#label}} must not exceed {{#limit}} characters',
    });

/**
 * Schema for a free-text identifier or label stored in the database.
 *
 * These never derive a filesystem path, so they are not held to the filename
 * allowlist — but they must still be strings, which is what keeps a structured
 * object out of the filter it ends up in.
 */
const textSchema = Joi.string().max(1024);

/** Schema for an identifier that selects a document. */
const idSchema = Joi.string().max(256);

/** Schema for a zero-based page number. */
const pageSchema = Joi.number().integer().min(0);

/** Schema for a millisecond timestamp. */
const timestampSchema = Joi.number().integer().min(0);

/** Schema for an http(s) URL. */
const urlSchema = Joi.string()
  .uri({ scheme: [/https?/] })
  .max(2048);

/**
 * Schema for a database connection configuration.
 *
 * Declared once because more than one endpoint accepts one: `POST
 * /api/data-storage` persists the default, and a simulation may carry its own
 * to override that default for a single run. Both decide which database the
 * product connects to, so both are held to the same shape — a caller must not
 * be able to point a run at a host of its choosing through whichever endpoint
 * happens to check less.
 */
const dataStorageSchema = documentSchema({
  protocol: Joi.string().valid('MONGODB').required(),
  connConfig: documentSchema({
    // Deliberately a character allowlist rather than a strict hostname check:
    // it still rules out the separators that would let a host rewrite the
    // connection string, without rejecting the service names an operator may
    // legitimately have configured.
    host: Joi.string()
      .pattern(/^[A-Za-z0-9._-]+$/)
      .max(253)
      .required(),
    port: Joi.number().integer().min(1).max(65535).required(),
    username: Joi.string().max(256).allow(null, ''),
    password: Joi.string().max(256).allow(null, ''),
    dbname: Joi.string().max(256).allow(null, ''),
    // The dashboard's connection form submits this field as the raw text the
    // operator typed — `ConnectionConfig` stringifies it for display and hands
    // back what was typed without parsing it — so a string is what actually
    // arrives. It is destructured but never read by the connector, so admitting
    // the string costs nothing; it stays bounded rather than becoming `any`.
    options: Joi.alternatives().try(Joi.object(), Joi.string().max(2048)).allow(null),
  }).required(),
});

/**
 * Schema for a dataset document a run or a recording writes into.
 *
 * Declared once because a simulation carries one as `newDataset` and a data
 * recorder carries one as `dataset`, and both end up in `saveDataset`, where
 * the `id` becomes the filter the dataset is looked up with. Unknown keys are
 * tolerated so a dataset read back from the database still round-trips.
 */
const datasetSchema = documentSchema({
  id: idSchema,
  name: textSchema.allow(null, ''),
  description: textSchema.allow(null, ''),
  tags: Joi.array().items(Joi.string().max(256)),
  source: textSchema.allow(null, ''),
});

/**
 * The fields a simulation run is configured with, wherever they arrive from.
 *
 * `Simulation` reads each of these straight off the model it is given and then
 * lets `options` overwrite it, so the two carry the same values and are held to
 * the same shapes. Every one of them reaches something that cares about its
 * type: `datasetId` becomes the MongoDB filter the original events are read
 * with, `newDataset.id` becomes the filter the generated ones are read back
 * with, and `dataStorage` decides which database the whole run connects to.
 * Left undeclared they arrive as any type at all, which is how a filter turns
 * into `{ $ne: null }` and a connection turns towards a host of the caller's
 * choosing.
 *
 * Declared here rather than in `routes/simulation.js` because a run does not
 * only read them from a request: `POST /api/models` persists a topology and
 * `POST /api/simulation/start` starts it from disk without revalidating, so the
 * route that stores a model has to constrain exactly the same fields as the
 * route that starts one. Sharing the declaration is what stops the two drifting.
 */
const simulationRunFields = {
  datasetId: idSchema.allow(null),
  // The dataset the run writes into; its `id` becomes a filter of its own.
  newDataset: datasetSchema.allow(null),
  replayOptions: documentSchema({
    // Null is how "no bound" is expressed here — `src/core/simulation` ships a
    // topology with both set to null and guards on truthiness — so these are
    // nullable like every other run field rather than merely absent.
    startTime: timestampSchema.allow(null),
    endTime: timestampSchema.allow(null),
    repeat: Joi.boolean(),
    speedup: Joi.number().positive(),
  }).allow(null),
  dataStorage: dataStorageSchema.allow(null),
  // Interpolated into a log filename by the devops flow, so it is held to the
  // filename allowlist rather than only to being a string.
  testCampaignId: safeNameSchema.allow(null),
  evaluationParameters: documentSchema({
    threshold: Joi.number(),
    eventType: Joi.string().max(256),
    metricType: Joi.string().max(256),
  }).allow(null),
};

module.exports = {
  validate,
  documentSchema,
  safeNameSchema,
  fileNameParam,
  fileNameMaxLength,
  generatedFileNameMaxLength,
  dataStorageSchema,
  datasetSchema,
  simulationRunFields,
  textSchema,
  idSchema,
  pageSchema,
  timestampSchema,
  urlSchema,
};
