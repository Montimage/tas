const Joi = require('joi');

/**
 * Convert the request validation schemas into OpenAPI 3.0 schema objects
 * (issue #47).
 *
 * The specification is generated from exactly the compiled `joi` schemas the
 * `validate` middleware enforces - read off each route's middleware stack, not
 * restated anywhere - so what the API accepts and what its specification says
 * cannot drift apart.
 *
 * The converter understands the subset of joi this codebase's schemas use:
 * objects (with unknown-key and forbidden-pattern rules), strings, numbers,
 * booleans, arrays, alternatives, enums, length/pattern bounds, defaults and
 * nullable allows. Anything it does not recognise converts permissively to an
 * empty schema rather than failing: a specification that omits a constraint it
 * cannot express is wrong in the safe direction, and one that throws is no
 * specification at all.
 */

/** OpenAPI 3.0 format hint for an http(s) URI string. */
const URI_FORMAT = 'uri';

/**
 * Normalise a regex the way `describe()` reports pattern rules: either a real
 * RegExp or the string form `/pattern/flags`.
 */
const describeRegex = (regex) => {
  if (regex instanceof RegExp) return regex.source;
  const text = String(regex || '');
  const match = /^\/(.*)\/[a-z]*$/.exec(text);
  return match ? match[1] : text;
};

/**
 * Apply a single named rule from a `describe()` node onto an OpenAPI schema.
 * Unknown rule names are ignored.
 */
const applyRule = (schema, name, args) => {
  switch (name) {
    case 'min':
      if (schema.type === 'string') schema.minLength = args.limit;
      else schema.minimum = args.limit;
      break;
    case 'max':
      if (schema.type === 'string') schema.maxLength = args.limit;
      else schema.maximum = args.limit;
      break;
    case 'integer':
      schema.type = 'integer';
      break;
    case 'sign':
      // `positive`/`negative`: expressed as an exclusive bound on zero.
      if (args.sign === 'positive') {
        schema.exclusiveMinimum = 0;
        delete schema.minimum;
      } else if (args.sign === 'negative') {
        schema.exclusiveMaximum = 0;
        delete schema.maximum;
      }
      break;
    case 'pattern':
    case 'regex':
      schema.pattern = describeRegex(args.regex);
      break;
    case 'uri':
      schema.format = URI_FORMAT;
      break;
    case 'email':
      schema.format = 'email';
      break;
    case 'iso':
      schema.format = 'date-time';
      break;
    default:
      break;
  }
};

/**
 * Convert one `describe()` node. Returns a fresh object every call; never
 * mutates the input.
 */
const convertNode = (node) => {
  if (!node || typeof node !== 'object') return {};

  const schema = {};
  const type = node.type;

  if (type === 'alternatives') {
    const branches = (node.matches || [])
      .map((match) => (match.schema ? convertNode(match.schema) : null))
      .filter(Boolean);
    return branches.length > 0 ? { anyOf: branches } : {};
  }

  switch (type) {
    case 'object': {
      schema.type = 'object';
      const properties = {};
      const required = [];
      for (const [key, child] of Object.entries(node.keys || {})) {
        properties[key] = convertNode(child);
        if (child.flags && child.flags.presence === 'required') required.push(key);
      }
      if (Object.keys(properties).length > 0) schema.properties = properties;
      if (required.length > 0) schema.required = required.sort();
      // `unknown(true)` tolerates round-tripped fields; anything else is
      // validated against declared keys only, which OpenAPI spells as a
      // closed object.
      schema.additionalProperties = Boolean(node.flags && node.flags.unknown);
      // Forbidden operator-key patterns are a database-safety rule with no
      // faithful OpenAPI spelling; they are documented once in the guide
      // rather than approximated per property here.
      break;
    }
    case 'array':
      schema.type = 'array';
      if (Array.isArray(node.items) && node.items.length > 0) {
        schema.items = convertNode(node.items[0]);
      }
      break;
    case 'number':
      schema.type = 'number';
      break;
    case 'boolean':
      schema.type = 'boolean';
      break;
    case 'function':
    case 'symbol':
      return { type: 'string' };
    case 'string':
    default:
      schema.type = 'string';
      break;
  }

  for (const rule of node.rules || []) {
    applyRule(schema, rule.name, rule.args || {});
  }

  // `valid()` marks the schema `only` and lists its values in `allow`; that
  // closed set is worth publishing as an enum.
  const allowed = node.allow || [];
  if (node.flags && node.flags.only) {
    const valids = allowed.filter((value) => value !== null && value !== '');
    if (valids.length > 0 && type !== 'object') schema.enum = valids;
  }

  // A nullable allow is OpenAPI 3.0's `nullable`; an empty-string allow only
  // says the field may be blank, which the type already admits.
  if (allowed.includes(null)) {
    schema.nullable = true;
  }

  if (node.flags) {
    if (node.flags.default !== undefined && typeof node.flags.default !== 'function') {
      schema.default = node.flags.default;
    }
    if (node.flags.description) schema.description = node.flags.description;
  }

  return schema;
};

/**
 * Convert a joi schema (compiled or plain) into an OpenAPI 3.0 schema object.
 *
 * @param {Object|Joi.Schema} schema The validation schema as written
 * @returns {Object} An OpenAPI schema object
 */
const toOpenApiSchema = (schema) => {
  try {
    const described = Joi.isSchema(schema) ? schema.describe() : Joi.compile(schema).describe();
    return convertNode(described);
  } catch (_) {
    // A schema this converter cannot describe must not break generation.
    return {};
  }
};

module.exports = { toOpenApiSchema };
