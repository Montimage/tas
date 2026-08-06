// read and pass the environment variables into reactjs application
// export const URL = `http://localhost:31057`;
export const URL = "";

/**
 * Name of the cookie the server puts the session's CSRF token in.
 *
 * Deliberately readable by JavaScript (see `src/server/middleware/auth.js`):
 * reading it here and echoing it back in a header is the entire mechanism that
 * tells the server this request came from the dashboard and not from a page on
 * somebody else's site.
 */
const CSRF_COOKIE = "tas.csrf";

/** The header the server expects the session's CSRF token in. */
const CSRF_HEADER = "X-CSRF-Token";

/**
 * The message a request that fell outside a live session is reported with.
 *
 * Exported so the login view can recognise it and phrase the prompt in the
 * same words the notification used.
 */
export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again.";

/**
 * Read the session's CSRF token out of `document.cookie`.
 *
 * Tolerant of every way the cookie can be missing - no document at all (a
 * test renderer), no cookie yet (not logged in), a value that is not valid
 * percent-encoding - because the caller's only sensible reaction to any of
 * them is the same: send an empty token and let the server refuse it.
 *
 * @returns {String} The token, or "" when there is none
 */
export const readCsrfToken = () => {
  if (typeof document === "undefined" || typeof document.cookie !== "string") {
    return "";
  }
  const prefix = `${CSRF_COOKIE}=`;
  const entries = document.cookie.split(";");
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index].trim();
    if (entry.indexOf(prefix) === 0) {
      const raw = entry.slice(prefix.length);
      try {
        return decodeURIComponent(raw);
      } catch (e) {
        return raw;
      }
    }
  }
  return "";
};

/**
 * The one subscriber notified when the API says the caller has no session.
 *
 * A module-level slot rather than a list: there is exactly one thing in the
 * app that reacts to this (the auth saga), and a list would quietly accumulate
 * stale handlers across hot reloads.
 */
let sessionExpiredHandler = null;

/**
 * Register the handler called when a request comes back 401.
 *
 * @param {Function|null} handler The handler, or null to unregister
 */
export const onSessionExpired = (handler) => {
  sessionExpiredHandler = typeof handler === "function" ? handler : null;
};

/** Tell the subscriber, if there is one, that the session is gone. */
const notifySessionExpired = () => {
  if (!sessionExpiredHandler) return;
  try {
    sessionExpiredHandler();
  } catch (e) {
    // A broken subscriber must not swallow the error the caller is about to
    // be thrown; there is nothing useful to do with it here.
  }
};

/**
 * `fetch`, with the two things every API call in this file needs.
 *
 * The session cookie has to be sent (`credentials`), and every state-changing
 * request has to echo the session's CSRF token or the server answers 403 (see
 * `src/server/middleware/csrf.js`). Attaching the token here rather than at
 * each of the ~50 call sites is what keeps a route added later from being the
 * one that forgets it.
 *
 * @param {String} url The absolute URL, already built from `URL`
 * @param {Object} [options] The usual `fetch` options
 * @returns {Promise<Response>}
 */
const apiFetch = (url, options = {}) => {
  const headers = { ...(options.headers || {}) };
  // Sent on every call, not only the unsafe methods: a handful of endpoints
  // (starting and stopping a campaign, a simulation or a recorder) mutate over
  // `GET`, and the server requires the token on those too — see
  // `MUTATING_SAFE_METHOD_PATHS` in `src/server/middleware/csrf.js`. Attaching
  // it unconditionally is also what keeps a route moved between methods later
  // from silently losing its protection.
  headers[CSRF_HEADER] = readCsrfToken();
  return fetch(url, {
    ...options,
    credentials: "same-origin",
    headers,
  });
};

/**
 * Build the message shown to the user from an error response.
 *
 * The API answers every failure with `{ error, details? }` (see
 * `src/server/middleware/errors.js`). `details` is the per-field breakdown of a
 * validation failure, and folding it into the message is what tells the user
 * *which* field was refused rather than only that something was.
 *
 * Always returns a string: the notification component renders anything else
 * with JSON.stringify, which turns an Error into the useless "{}".
 *
 * @param {Object|null} data The parsed response body, when there was one
 * @param {Response} response The fetch response
 * @returns {String}
 */
const errorMessage = (data, response) => {
  const base =
    data && typeof data.error === "string" && data.error
      ? data.error
      : `Request failed (HTTP ${response.status})`;
  const details = data && Array.isArray(data.details) ? data.details : [];
  if (details.length === 0) return base;
  const named = details
    .map((detail) =>
      detail && typeof detail === "object"
        ? detail.message || detail.field
        : String(detail)
    )
    .filter(Boolean);
  return named.length > 0 ? `${base}: ${named.join("; ")}` : base;
};

/**
 * Read a response, honouring the HTTP status code.
 *
 * The server used to answer 200 for everything and signal failure only with an
 * `error` field, so this layer could get away with looking at the body alone.
 * It now answers 400/404/409/5xx (issue #11), which is the only thing that
 * distinguishes a served request from a failed one when the body is empty or is
 * not JSON at all - a proxy's error page, say.
 *
 * Failures are still thrown, and still thrown as a plain string, because that
 * is what every saga's `catch` puts straight into a notification.
 *
 * A 401 is the one status with a second consequence: it means the session the
 * request was made under is gone, which the rest of the app has to know about
 * even though the caller only sees a thrown string. The registered subscriber
 * is told before the throw, so the dashboard can offer a sign-in without any
 * saga having to learn a new failure shape. `authRequest` opts the three
 * authentication calls out of that: a refused *login* is not an expired
 * session, and reporting it as one would replace "Invalid credentials" with a
 * message about a session the user never had.
 *
 * @param {Response} response The fetch response
 * @param {Object} [options] `{ authRequest }` for calls under `/api/auth`
 * @returns {Promise<Object>} The parsed body of a successful response
 */
const parseResponse = async (response, options = {}) => {
  let body = null;
  try {
    body = await response.json();
  } catch (e) {
    // A non-JSON body (an error page from a proxy, an empty response) must not
    // surface as a raw SyntaxError.
    body = null;
  }
  if (response.status === 401 && options.authRequest !== true) {
    notifySessionExpired();
    throw SESSION_EXPIRED_MESSAGE;
  }
  if (!response.ok || (body && body.error)) {
    throw errorMessage(body, response);
  }
  return body === null ? {} : body;
};

// MODELS
export const requestAllModels = async () => {
  const url = `${URL}/api/models`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.models;
};

export const requestDeleteModel = async (modelFileName) => {
  const url = `${URL}/api/models/${modelFileName}`;
  const response = await apiFetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

export const requestDuplicateModel = async (modelFileName) => {
  const url = `${URL}/api/models/${modelFileName}`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      isDuplicated: true,
    }),
  });
  const data = await parseResponse(response);
  return data.modelFileName;
};

export const requestModel = async (modelFileName) => {
  const url = `${URL}/api/models/${modelFileName}`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.model;
};

export const uploadModel = async (model) => {
  const url = `${URL}/api/models`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model }),
  });
  const data = await parseResponse(response);
  return data.modelFileName;
};

export const updateModel = async (modelFileName, model) => {
  const url = `${URL}/api/models/${modelFileName}`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model }),
  });
  const data = await parseResponse(response);
  return data.modelFileName;
};

// DATA RECORDERS
export const requestAllDataRecorders = async () => {
  const url = `${URL}/api/data-recorders/models`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.dataRecorders;
};

export const requestDeleteDataRecorder = async (dataRecorderFileName) => {
  const url = `${URL}/api/data-recorders/models/${dataRecorderFileName}`;
  const response = await apiFetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

export const requestDuplicateDataRecorder = async (dataRecorderFileName) => {
  const url = `${URL}/api/data-recorders/models/${dataRecorderFileName}`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      isDuplicated: true,
    }),
  });
  const data = await parseResponse(response);
  return data.dataRecorderFileName;
};

export const requestDataRecorder = async (dataRecorderFileName) => {
  const url = `${URL}/api/data-recorders/models/${dataRecorderFileName}`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.dataRecorder;
};

export const uploadDataRecorder = async (dataRecorder) => {
  const url = `${URL}/api/data-recorders/models`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dataRecorder }),
  });
  const data = await parseResponse(response);
  return data.dataRecorderFileName;
};

export const updateDataRecorder = async (
  dataRecorderFileName,
  dataRecorder
) => {
  const url = `${URL}/api/data-recorders/models/${dataRecorderFileName}`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dataRecorder }),
  });
  const data = await parseResponse(response);
  return data.dataRecorderFileName;
};

export const sendRequestStartDataRecorder = async (dataRecorderFileName) => {
  const url = `${URL}/api/data-recorders/start`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dataRecorderFileName }),
  });
  const data = await parseResponse(response);
  return data.status;
};

export const sendRequestStopDataRecorder = async (fileName) => {
  const url = `${URL}/api/data-recorders/stop/${fileName}`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.status;
};

export const sendRequestDataRecorderStatus = async () => {
  const url = `${URL}/api/data-recorders/status`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.status;
};

// DATA STORAGE
export const sendRequestDataStorage = async () => {
  const url = `${URL}/api/data-storage`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.dataStorage;
};

export const sendRequestUpdateDataStorage = async (dataStorage) => {
  const url = `${URL}/api/data-storage`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dataStorage }),
  });
  const data = await parseResponse(response);
  return data.dataStorage;
};

export const sendRequestTestDataStorageConnection = async (dataStorage) => {
  const url = `${URL}/api/data-storage/test`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.connectionStatus;
};

export const sendRequestLogFile = async (tool, logFile) => {
  const url = `${URL}/api/logs/${tool}/${logFile}`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.content;
};

export const sendRequestDeleteLogFile = async (tool, logFile) => {
  const url = `${URL}/api/logs/${tool}/${logFile}`;
  const response = await apiFetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

export const sendRequestAllLogFiles = async (tool) => {
  const url = `${URL}/api/logs/${tool}`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.files;
};

export const requestStartDeploy = async (tool, model) => {
  const url = `${URL}/api/${tool}/deploy`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model }),
  });
  const data = await parseResponse(response);
  return data.simulationStatus;
};

export const sendRequestStopSimulation = async (fileName) => {
  const url = `${URL}/api/simulation/stop/${fileName}`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.simulationStatus;
};

export const sendRequestSimulationStatus = async () => {
  const url = `${URL}/api/simulation/status`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.simulationStatus;
};

// Test campaigns
export const sendRequestTestCampaign = async (tcId) => {
  const url = `${URL}/api/test-campaigns/${tcId}`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.testCampaign;
};

export const sendRequestUpdateTestCampaign = async (id, testCampaign) => {
  const url = `${URL}/api/test-campaigns/${id}`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ testCampaign }),
  });
  const data = await parseResponse(response);
  return data.testCampaign;
};

export const sendRequestAllTestCampaigns = async () => {
  const url = `${URL}/api/test-campaigns`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.testCampaigns;
};

export const sendRequestAddNewTestCampaign = async (testCampaign) => {
  const url = `${URL}/api/test-campaigns`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ testCampaign }),
  });
  const data = await parseResponse(response);
  return data.testCampaign;
};

export const sendRequestDeleteTestCampaign = async (testCampaignId) => {
  const url = `${URL}/api/test-campaigns/${testCampaignId}`;
  const response = await apiFetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

// Devops
export const sendRequestDevops = async () => {
  const url = `${URL}/api/devops`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.devops;
};

export const sendRequestUpdateDevops = async (devops) => {
  const url = `${URL}/api/devops`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ devops }),
  });
  const data = await parseResponse(response);
  return data.devops;
};

// Test cases
export const sendRequestTestCase = async (tcId) => {
  const url = `${URL}/api/test-cases/${tcId}`;
  const response = await apiFetch(url);
  const status = await parseResponse(response);
  return status.testCase;
};

export const sendRequestUpdateTestCase = async (id, testCase) => {
  const url = `${URL}/api/test-cases/${id}`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ testCase }),
  });
  const data = await parseResponse(response);
  return data.testCase;
};

export const sendRequestAllTestCases = async () => {
  const url = `${URL}/api/test-cases`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.testCases;
};

export const sendRequestAddNewTestCase = async (testCase) => {
  const url = `${URL}/api/test-cases`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ testCase }),
  });
  const data = await parseResponse(response);
  return data.testCase;
};

export const sendRequestDeleteTestCase = async (testCaseId) => {
  const url = `${URL}/api/test-cases/${testCaseId}`;
  const response = await apiFetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

// Dataset
export const sendRequestDataset = async (tcId) => {
  const url = `${URL}/api/data-sets/${tcId}`;
  const response = await apiFetch(url);
  const status = await parseResponse(response);
  return status.dataset;
};

export const sendRequestUpdateDataset = async (id, dataset) => {
  const url = `${URL}/api/data-sets/${id}`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dataset }),
  });
  const data = await parseResponse(response);
  return data.dataset;
};

export const sendRequestAllDatasets = async () => {
  const url = `${URL}/api/data-sets`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return data.datasets;
};

export const sendRequestAddNewDataset = async (dataset) => {
  const url = `${URL}/api/data-sets`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dataset }),
  });
  const data = await parseResponse(response);
  return data.dataset;
};

export const sendRequestDeleteDataset = async (datasetId) => {
  const url = `${URL}/api/data-sets/${datasetId}`;
  const response = await apiFetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

// Reports
export const sendRequestReport = async (rpId) => {
  const url = `${URL}/api/reports/${rpId}`;
  const response = await apiFetch(url);
  const status = await parseResponse(response);
  return status;
};

export const sendRequestAllReports = async (options) => {
  const { topologyFileName, testCampaignId } = options;
  let query = "";
  if (topologyFileName) {
    query = `?topologyFileName=${topologyFileName}`;
    if (testCampaignId) {
      query = `&testCampaignId=${testCampaignId}`;
    }
  } else {
    if (testCampaignId) {
      query = `?testCampaignId=${testCampaignId}`;
    }
  }

  const url = `${URL}/api/reports${query}`;
  const response = await apiFetch(url);
  const status = await parseResponse(response);
  return status.reports;
};

export const sendRequestDeleteReport = async (reportId) => {
  const url = `${URL}/api/reports/${reportId}`;
  const response = await apiFetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

export const sendRequestUpdateReport = async (id, report, newScore) => {
  console.log('Update report: ', id, report, newScore);
  const url = `${URL}/api/reports/${id}`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ report, newScore }),
  });
  const data = await parseResponse(response);
  return data.report;
};

// Event
export const sendRequestEvent = async (tcId) => {
  const url = `${URL}/api/events/${tcId}`;
  const response = await apiFetch(url);
  const status = await parseResponse(response);
  return status.event;
};

export const sendRequestUpdateEvent = async (id, event) => {
  const url = `${URL}/api/events/${id}`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event }),
  });
  const data = await parseResponse(response);
  return data.event;
};

export const sendRequestEventsByDatasetId = async (
  datasetId,
  startTime,
  endTime,
  page = 0
) => {
  const url = `${URL}/api/events?datasetId=${datasetId}&startTime=${
    startTime ? startTime : 0
  }&endTime=${endTime ? endTime : Date.now()}&page=${page}`;
  const response = await apiFetch(url);
  const data = await parseResponse(response);
  return {totalNbEvents: data.totalNbEvents, events: data.events};
};

export const sendRequestAddNewEvent = async (event) => {
  const url = `${URL}/api/events`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event }),
  });
  const data = await parseResponse(response);
  return data.event;
};

export const sendRequestDeleteEvent = async (eventId) => {
  const url = `${URL}/api/events/${eventId}`;
  const response = await apiFetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

export const sendRequestStartSimulation = async (
  modelFileName,
  datasetId,
  newDataset
) => {
  const url = `${URL}/api/simulation/start`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modelFileName,
      options: {
        datasetId,
        newDataset,
      },
    }),
  });
  const data = await parseResponse(response);
  return data.simulationStatus;
};

// Test campaign
export const sendRequestLaunchTestCampaign = async () => {
  const url = `${URL}/api/devops/start`;
  const response = await apiFetch(url);
  const status = await parseResponse(response);
  return status.runningStatus;
};

export const sendRequestStopTestCampaign = async () => {
  const url = `${URL}/api/devops/stop`;
  const response = await apiFetch(url);
  const status = await parseResponse(response);
  return status.runningStatus;
};

export const sendRequestTestCampaignStatus = async () => {
  const url = `${URL}/api/devops/status`;
  const response = await apiFetch(url);
  const status = await parseResponse(response);
  return status.runningStatus;
};

// AUTHENTICATION
export const requestLogin = async ({ username, password }) => {
  const url = `${URL}/api/auth/login`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
  // The whole body is the session: `{ authenticated, user, csrfToken }`.
  const data = await parseResponse(response, { authRequest: true });
  return data;
};

export const requestLogout = async () => {
  const url = `${URL}/api/auth/logout`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await parseResponse(response, { authRequest: true });
  return data;
};

export const requestSession = async () => {
  // Answers 200 either way, on purpose, so a cold start can ask "am I logged
  // in?" without turning every anonymous load into a 401.
  const url = `${URL}/api/auth/session`;
  const response = await apiFetch(url);
  const data = await parseResponse(response, { authRequest: true });
  return data;
};
