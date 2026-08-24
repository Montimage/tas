The TaS dashboard client is built with [Vite](https://vite.dev) and React 18.

## Available Scripts

In the project directory, you can run:

### `npm start`

Starts the Vite development server with hot module reload.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br />
You will also see any lint errors in the console.

### `npm test`

Runs the Vitest suite once (`vitest run`) and exits with a pass/fail status.

### `npm run build`

Builds the app for production with `vite build`, emitting the bundle to
`../public` (i.e. `src/public/`), which the server serves at `/`.<br />
The compiled bundle is not committed to the repository.

## State management

The dashboard uses Redux Toolkit. Each domain owns a slice in `src/slices/`
(state + generated action creators); `src/actions/index.js` is only a
re-export barrel kept for stable imports across pages, components and sagas,
and `src/reducers/index.js` combines the slices under the historical state
keys. The global `requesting` spinner flag is expressed once in
`slices/requestingSlice.js` as declarative request/settle pairs.

Redux-saga remains for asynchronous flows that are genuinely awkward as plain
thunks/listeners; these are the flows to know about before touching `src/sagas/`:

- **Session lifecycle** (`authSaga.js`) — checks who the user is on mount,
  handles login/logout, and bridges the api layer's session-expiry callback
  into the store through a redux-saga `eventChannel`.
- **Request/response fan-out** — every `request*` action triggers a server
  call whose result is re-dispatched as the matching `*OK`/set action, with
  errors surfaced as notifications (`requestModelSaga`, `datasetsSaga`,
  `eventsSaga`, `reportsSaga`, and friends).
- **Simulation & data-recorder control** (`simulationSaga.js`,
  `requestDataRecorderSaga.js`) — start/stop/status polling against long-running
  jobs.
- **Devops loop** (`devopsSaga.js`) — fetches evaluation configuration used by
  the devops dashboard.
