// read and pass the environment variables into reactjs application
// export const URL = `http://localhost:31057`;
export const URL = "";

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
 * @param {Response} response The fetch response
 * @returns {Promise<Object>} The parsed body of a successful response
 */
const parseResponse = async (response) => {
  let body = null;
  try {
    body = await response.json();
  } catch (e) {
    // A non-JSON body (an error page from a proxy, an empty response) must not
    // surface as a raw SyntaxError.
    body = null;
  }
  if (!response.ok || (body && body.error)) {
    throw errorMessage(body, response);
  }
  return body === null ? {} : body;
};

// MODELS
export const requestAllModels = async () => {
  const url = `${URL}/api/models`;
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.models;
};

export const requestDeleteModel = async (modelFileName) => {
  const url = `${URL}/api/models/${modelFileName}`;
  const response = await fetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

export const requestDuplicateModel = async (modelFileName) => {
  const url = `${URL}/api/models/${modelFileName}`;
  const response = await fetch(url, {
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
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.model;
};

export const uploadModel = async (model) => {
  const url = `${URL}/api/models`;
  const response = await fetch(url, {
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
  const response = await fetch(url, {
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
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.dataRecorders;
};

export const requestDeleteDataRecorder = async (dataRecorderFileName) => {
  const url = `${URL}/api/data-recorders/models/${dataRecorderFileName}`;
  const response = await fetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

export const requestDuplicateDataRecorder = async (dataRecorderFileName) => {
  const url = `${URL}/api/data-recorders/models/${dataRecorderFileName}`;
  const response = await fetch(url, {
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
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.dataRecorder;
};

export const uploadDataRecorder = async (dataRecorder) => {
  const url = `${URL}/api/data-recorders/models`;
  const response = await fetch(url, {
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
  const response = await fetch(url, {
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
  const response = await fetch(url, {
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
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.status;
};

export const sendRequestDataRecorderStatus = async () => {
  const url = `${URL}/api/data-recorders/status`;
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.status;
};

// DATA STORAGE
export const sendRequestDataStorage = async () => {
  const url = `${URL}/api/data-storage`;
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.dataStorage;
};

export const sendRequestUpdateDataStorage = async (dataStorage) => {
  const url = `${URL}/api/data-storage`;
  const response = await fetch(url, {
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
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.connectionStatus;
};

export const sendRequestLogFile = async (tool, logFile) => {
  const url = `${URL}/api/logs/${tool}/${logFile}`;
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.content;
};

export const sendRequestDeleteLogFile = async (tool, logFile) => {
  const url = `${URL}/api/logs/${tool}/${logFile}`;
  const response = await fetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

export const sendRequestAllLogFiles = async (tool) => {
  const url = `${URL}/api/logs/${tool}`;
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.files;
};

export const requestStartDeploy = async (tool, model) => {
  const url = `${URL}/api/${tool}/deploy`;
  const response = await fetch(url, {
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
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.simulationStatus;
};

export const sendRequestSimulationStatus = async () => {
  const url = `${URL}/api/simulation/status`;
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.simulationStatus;
};

// Test campaigns
export const sendRequestTestCampaign = async (tcId) => {
  const url = `${URL}/api/test-campaigns/${tcId}`;
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.testCampaign;
};

export const sendRequestUpdateTestCampaign = async (id, testCampaign) => {
  const url = `${URL}/api/test-campaigns/${id}`;
  const response = await fetch(url, {
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
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.testCampaigns;
};

export const sendRequestAddNewTestCampaign = async (testCampaign) => {
  const url = `${URL}/api/test-campaigns`;
  const response = await fetch(url, {
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
  const response = await fetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

// Devops
export const sendRequestDevops = async () => {
  const url = `${URL}/api/devops`;
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.devops;
};

export const sendRequestUpdateDevops = async (devops) => {
  const url = `${URL}/api/devops`;
  const response = await fetch(url, {
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
  const response = await fetch(url);
  const status = await parseResponse(response);
  return status.testCase;
};

export const sendRequestUpdateTestCase = async (id, testCase) => {
  const url = `${URL}/api/test-cases/${id}`;
  const response = await fetch(url, {
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
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.testCases;
};

export const sendRequestAddNewTestCase = async (testCase) => {
  const url = `${URL}/api/test-cases`;
  const response = await fetch(url, {
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
  const response = await fetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

// Dataset
export const sendRequestDataset = async (tcId) => {
  const url = `${URL}/api/data-sets/${tcId}`;
  const response = await fetch(url);
  const status = await parseResponse(response);
  return status.dataset;
};

export const sendRequestUpdateDataset = async (id, dataset) => {
  const url = `${URL}/api/data-sets/${id}`;
  const response = await fetch(url, {
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
  const response = await fetch(url);
  const data = await parseResponse(response);
  return data.datasets;
};

export const sendRequestAddNewDataset = async (dataset) => {
  const url = `${URL}/api/data-sets`;
  const response = await fetch(url, {
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
  const response = await fetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

// Reports
export const sendRequestReport = async (rpId) => {
  const url = `${URL}/api/reports/${rpId}`;
  const response = await fetch(url);
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
  const response = await fetch(url);
  const status = await parseResponse(response);
  return status.reports;
};

export const sendRequestDeleteReport = async (reportId) => {
  const url = `${URL}/api/reports/${reportId}`;
  const response = await fetch(url, {
    method: "DELETE",
  });
  const data = await parseResponse(response);
  return data.result;
};

export const sendRequestUpdateReport = async (id, report, newScore) => {
  console.log('Update report: ', id, report, newScore);
  const url = `${URL}/api/reports/${id}`;
  const response = await fetch(url, {
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
  const response = await fetch(url);
  const status = await parseResponse(response);
  return status.event;
};

export const sendRequestUpdateEvent = async (id, event) => {
  const url = `${URL}/api/events/${id}`;
  const response = await fetch(url, {
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
  const response = await fetch(url);
  const data = await parseResponse(response);
  return {totalNbEvents: data.totalNbEvents, events: data.events};
};

export const sendRequestAddNewEvent = async (event) => {
  const url = `${URL}/api/events`;
  const response = await fetch(url, {
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
  const response = await fetch(url, {
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
  const response = await fetch(url, {
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
  const response = await fetch(url);
  const status = await parseResponse(response);
  return status.runningStatus;
};

export const sendRequestStopTestCampaign = async () => {
  const url = `${URL}/api/devops/stop`;
  const response = await fetch(url);
  const status = await parseResponse(response);
  return status.runningStatus;
};

export const sendRequestTestCampaignStatus = async () => {
  const url = `${URL}/api/devops/status`;
  const response = await fetch(url);
  const status = await parseResponse(response);
  return status.runningStatus;
};
