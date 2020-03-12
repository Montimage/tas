// read and pass the environment variables into reactjs application
const URL = `http://localhost:31057`;

const requestModel = async (tool) => {
  const url = `${URL}/api/${tool}`;
  const response = await fetch(url);
  const data = await response.json();
  if (response.status >= 400) {
    throw new Error(data.errors);
  }
  return data;
};

const requestLogs = async (tool) => {
  const url = `${URL}/api/${tool}/logs`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) {
    throw data.error;
  }
  return data.content;
};

const requestStartDeploy = async (tool) => {
  const url = `${URL}/api/${tool}/run`;
  const response = await fetch(url);
  const data = await response.json();
  if (response.status >= 400) {
    throw new Error(data.errors);
  }
  return data;
};

const requestStopDeploy = async (tool) => {
  const url = `${URL}/api/${tool}/stop`;
  const response = await fetch(url);
  const data = await response.json();
  if (response.status >= 400) {
    throw new Error(data.errors);
  }
  return data;
};

const uploadModel = async (tool, model) => {
  const url = `${URL}/api/${tool}`;
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
  requestModel,
  uploadModel,
  requestStartDeploy,
  requestStopDeploy,
  requestLogs
};
