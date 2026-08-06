const Joi = require("joi");

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
  { key: "params", options: { abortEarly: false, convert: true } },
  { key: "query", options: { abortEarly: false, stripUnknown: true, convert: true } },
  { key: "body", options: { abortEarly: false, convert: true } },
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
const compileSchema = (schema) =>
  Joi.isSchema(schema) ? schema : Joi.compile(schema);

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
      schemas[key] === undefined || schemas[key] === null
        ? NOTHING_DECLARED
        : schemas[key]
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
            field: detail.path.length > 0 ? detail.path.join(".") : key,
            message: detail.message,
            type: detail.type,
          });
        }
      } else {
        validated.push({ key, value });
      }
    }

    if (details.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        details,
      });
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
 * @param {Object} keys Declared fields of the document
 * @returns {Joi.Schema}
 */
const documentSchema = (keys) =>
  Joi.object(keys).pattern(MONGO_OPERATOR_KEY, Joi.any().forbidden()).unknown(true);

/**
 * Schema for a name that is used to derive a filename on disk.
 *
 * Deliberately the same allowlist as `routes/path-safety.js`: a name that this
 * schema accepts is a name that containment will also accept, so the two never
 * disagree about what is safe.
 */
const safeNameSchema = Joi.string()
  .pattern(/^[A-Za-z0-9][A-Za-z0-9 _\-.()\[\]+@'#]*$/)
  .max(128)
  .messages({
    "string.pattern.base":
      "{{#label}} must start with an alphanumeric character and contain only safe characters",
    "string.max": "{{#label}} must not exceed 128 characters",
  });

/**
 * Build a schema for a filename parameter with a fixed extension.
 *
 * @param {String} extension Extension including the dot, e.g. `.json`
 * @returns {Joi.Schema}
 */
const fileNameParam = (extension) =>
  Joi.string()
    .pattern(new RegExp(`^[A-Za-z0-9][A-Za-z0-9 _\\-.()\\[\\]+@'#]*\\${extension}$`))
    .max(128)
    .required()
    .messages({
      "string.pattern.base": `{{#label}} must be a safe ${extension} file name`,
      "string.max": "{{#label}} must not exceed 128 characters",
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
const urlSchema = Joi.string().uri({ scheme: [/https?/] }).max(2048);

module.exports = {
  validate,
  documentSchema,
  safeNameSchema,
  fileNameParam,
  textSchema,
  idSchema,
  pageSchema,
  timestampSchema,
  urlSchema,
};
