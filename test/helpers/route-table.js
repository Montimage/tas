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
 * Recover the path a layer was mounted at from the regexp Express compiled for
 * it. Express keeps no copy of the original string, and reading the live stack
 * is the only way to see what the guard actually sees: a source-text scan would
 * miss a computed path, a `router.route(...)`, a route registered outside
 * `src/server/routes/`, and every extra mount of a router mounted more than
 * once — each of which is a way for an unprotected route to ship green.
 *
 * @param {Object} layer An Express router-stack layer
 * @returns {String} The mount path, or "" for a layer that matches everything
 */
function layerPath(layer) {
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
