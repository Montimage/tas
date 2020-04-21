// read and pass the environment variables into reactjs application
// const URL = `http://localhost:31057`;
const URL = "";

const requestModel = async (tool) => {
  const url = `${URL}/api/${tool}/model`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.model;
};

const uploadModel = async (tool, model) => {
  const url = `${URL}/api/${tool}/model`;
  const response = await fetch(url,{
    method: 'POST',
    headers: {
      'Content-Type':'application/json'
    },
    body: JSON.stringify({model})
  });
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.model;
};

const requestLogs = async (tool, logFile) => {
  const url = `${URL}/api/${tool}/logs/${logFile}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.content;
};

const requestDeleteLogFile = async (tool, logFile) => {
  const url = `${URL}/api/${tool}/logs/${logFile}`;
  const response = await fetch(url, {
    method: 'POST'
  });
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.result;
};


const requestLogFiles = async (tool) => {
  const url = `${URL}/api/${tool}/logs`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.files;
};

const requestStartDeploy = async (tool, model) => {
  const url = `${URL}/api/${tool}/deploy`;
  const response = await fetch(url,{
    method: 'POST',
    headers: {
      'Content-Type':'application/json'
    },
    body: JSON.stringify({model})
  });
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.deployStatus;
};

const requestStopDeploy = async (tool) => {
  const url = `${URL}/api/${tool}/stop`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.deployStatus;
};

const requestDeployStatus = async (tool) => {
  const url = `${URL}/api/${tool}/status`;
  const response = await fetch(url);
  const status = await response.json();
  if (status.error) {
    throw status.error;
  }
  return status.deployStatus;
};

export {
  requestModel,
  uploadModel,
  requestStartDeploy,
  requestStopDeploy,
  requestDeployStatus,
  requestLogs,
  requestLogFiles,
  requestDeleteLogFile
};
