import { createAction, createSlice } from '@reduxjs/toolkit';

// Request triggers: watched by the devops saga and tracked by the global
// `requesting` flag, but no reducer of this domain consumes them.
export const requestDevops = createAction('REQUEST_DEVOPS');
export const requestUpdateDevops = createAction('REQUEST_UPDATE_DEVOPS');

export const devopsSlice = createSlice({
  name: 'devops',
  initialState: null,
  reducers: {
    setDevops: (state, action) => action.payload,
  },
});

export const { setDevops } = devopsSlice.actions;
