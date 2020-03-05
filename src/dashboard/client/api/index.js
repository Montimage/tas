// read and pass the environment variables into reactjs application
const URL = `http://localhost:31057`;

const fetchModel = async () => {
  const url = `${URL}/api/simulation`;
  const response = await fetch(url);
  const data = await response.json();
  if (response.status >= 400) {
    throw new Error(data.errors);
  }
  return data;
};

const fetchLogs = async () => {
  const url = `${URL}/api/simulation/logs`;
  const response = await fetch(url);
  const data = await response.text();
  if (response.status >= 400) {
    throw new Error(data);
  }
  return data;
};

const requestStartDeploy = async () => {
  const url = `${URL}/api/simulation/run`;
  const response = await fetch(url);
  const data = await response.json();
  if (response.status >= 400) {
    throw new Error(data.errors);
  }
  return data;
};

const requestStopDeploy = async () => {
  const url = `${URL}/api/simulation/stop`;
  const response = await fetch(url);
  const data = await response.json();
  if (response.status >= 400) {
    throw new Error(data.errors);
  }
  return data;
};

const saveModel = async (model) => {
  const url = `${URL}/api/simulation`;
  const response = await fetch(url,{
    method: 'POST',
    headers: {
      'Content-Type':'application/json'
    },
    body: JSON.stringify({data: model})
  });
  const data = await response.json();
  if (response.status >= 400) {
    throw new Error(data.errors);
  }
  return data;
};

export {
  fetchModel,
  saveModel,
  requestStartDeploy,
  requestStopDeploy,
  fetchLogs
};
