import { createAction, createSlice } from '@reduxjs/toolkit';

// Request trigger: tracked by the global `requesting` flag, consumed by no
// reducer of this domain.
export const requestStats = createAction('REQUEST_STATS');

export const statsSlice = createSlice({
  name: 'stats',
  initialState: [],
  reducers: {
    requestStatsOK: (state, action) => action.payload,
  },
});

export const { requestStatsOK } = statsSlice.actions;
