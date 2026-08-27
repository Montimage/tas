'use strict';
/**
 * Central storage-root resolution (issue #58).
 *
 * Every persisted artefact the server owns lives under two directories that
 * used to be derived from `__dirname` at require time in six different route
 * modules: the `data/` tree (topologies, recorders, data-storage.json,
 * devops.json, the runtime-state store) and the `logs/` tree (simulation,
 * recorder and test-campaign logs).
 *
 * Setting `TAS_STORAGE_ROOT` relocates BOTH trees under one directory, which
 * is how the end-to-end suites give each spawned instance its own throwaway
 * storage root under the system temp dir - a crashed run can then leave
 * nothing behind in the checkout. With no override the root is this server
 * directory, so a deployed instance resolves exactly the same paths it always
 * did (`<server>/data` and `<server>/logs`).
 *
 * The finer-grained overrides that predate this module (`TAS_MODELS_DIR`,
 * `TAS_DATA_RECORDERS_DIR`, `TAS_DATA_DIR`, `TAS_RUNTIME_STATE_PATH`) still
 * win over the root for their one directory, unchanged.
 */
const path = require('path');

const SERVER_ROOT = process.env.TAS_STORAGE_ROOT || __dirname;
const DATA_DIR = path.join(SERVER_ROOT, 'data');
const LOGS_DIR = path.join(SERVER_ROOT, 'logs');

module.exports = { SERVER_ROOT, DATA_DIR, LOGS_DIR };
