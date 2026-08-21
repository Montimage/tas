/**
 * The live Express route-table walker, shared by the suites that have to see
 * the routes the running application actually mounts.
 *
 * Kept in one place because more than one suite depends on it: the CSRF
 * classification guard (`test/auth-csrf.test.js`) and the anonymous-rejection
 * enumeration (`test/e2e/auth-journey.test.js`, issue #14). Two copies of a
 * walker are two chances for one of them to quietly stop finding routes, and a
 * walker that finds nothing makes every test built on it pass vacuously.
 */

/**
 * Express 5 (router@2) compiles mount paths into matcher closures and keeps no
 * readable copy of the original string on the layer — `layer.regexp` is gone,
 * so the old source-text recovery below finds nothing and every walk comes
 * back empty. Requiring this module therefore patches the Layer constructor in
 * the require cache, before anything has loaded `router`, so every layer born
 * afterwards records its original path. A constructor that returns an object
 * replaces the `new`-built one, and the instance handed to `Router.use` is
 * still a genuine Layer, so Express behaviour is unchanged.
 */
const LAYER_MODULE = 'router/lib/layer';
try {
  const RealLayer = require(LAYER_MODULE);
  require.cache[require.resolve(LAYER_MODULE)].exports = function RecordedLayer(path, options, fn) {
    const instance = new RealLayer(path, options, fn);
    instance.originalPath = Array.isArray(path) ? path[0] : path;
    return instance;
  };
} catch (e) {
  // An older Express that still exposes `layer.regexp` needs no patch; the
  // regexp-based recovery in `layerPath` handles it.
}

/**
 * Recover the path a layer was mounted at.
 *
 * On Express 5 this reads the original path recorded at construction (see the
 * patch above). On Express 4 it falls back to recovering the prefix from the
 * compiled regexp, which was the only copy Express kept there.
 *
 * @param {Object} layer An Express router-stack layer
 * @returns {String} The mount path, or "" for a layer that matches everything
 */
function layerPath(layer) {
  if (typeof layer.originalPath === 'string') {
    return layer.originalPath === '/' ? '' : layer.originalPath;
  }
  if (layer.regexp && layer.regexp.fast_slash) return '';
  const source = String((layer.regexp && layer.regexp.source) || '');
  const trimmed = source
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\\\/\?\$$/, '')
    .replace(/\$$/, '');
  return trimmed.replace(/\\(.)/g, '$1');
}

/**
 * Walk a mounted Express application and yield every route it can reach.
 *
 * @param {Object} stack A router stack
 * @param {String} prefix The path this stack is mounted at
 * @returns {Array<{path: String, methods: Object}>} The routes found
 */
function collectRoutes(stack, prefix) {
  const found = [];
  for (const layer of stack || []) {
    if (layer.route) {
      const routePath = layer.route.path === '/' ? '' : layer.route.path;
      found.push({
        path: (prefix + routePath).replace(/\/+$/, '') || '/',
        methods: layer.route.methods || {},
      });
    } else if (layer.handle && layer.handle.stack) {
      found.push(...collectRoutes(layer.handle.stack, prefix + layerPath(layer)));
    }
  }
  return found;
}

module.exports = { layerPath, collectRoutes };
