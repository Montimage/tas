# Changelog

All notable changes to TaS are documented in this file. Releases are cut as
`v*` tags and published as the `ghcr.io/montimage/tas` container image (stable
`vX.Y.Z` tags also move the `latest` tag). The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.1.0] - 2026-08-28

### Added

- **Structured logging with correlation ids and a published API specification**
  (#47): log records are one machine-parseable JSON object per line carrying
  `timestamp`, `level`, `label` and structured fields; every request is assigned
  a correlation id (an incoming `X-Request-Id` is honoured) that is echoed in
  the response header and attached to the access record and any failure record,
  and each simulation, data-recorder or test-campaign run stamps all of its own
  lines with its run id. Verbosity is operator-configurable via `LOG_LEVEL`
  (`error|warn|info|debug`, default `info`; an unsupported value falls back to
  `info` with a warning). Values reached through sensitive keys are redacted
  before anything is written, on top of the existing credential-redaction
  guarantees (#72). The API specification is generated from the mounted routers
  and the compiled validation schemas the server enforces — served live at
  `GET /openapi.json` and committed at the repository root (`npm run spec`
  regenerates it) — so it cannot drift from the implementation.
- **Phase 6 milestone gate — deployment smoke test** (#49):
  `test/e2e/deployment-smoke.test.js` brings up the published composition
  exactly as a new user would (`docker compose up -d`, credentials provisioned
  as README.md documents) and asserts the dashboard, API health, authenticated
  broker and flow editor are reachable; a complete workflow (topology →
  producing simulation through the internal broker listener → clean stop)
  succeeds against the deployed stack; restarting each service independently
  leaves the others running and everything recovers; the application runs as a
  non-root user with Phase 0 containment and anonymous-access rejection intact.
  The release workflow runs it on every `v*` tag between the test gate and
  publishing (`needs: [test, smoke]`), and its Trivy scan now blocks
  publication on any known fixable CRITICAL vulnerability. Published host
  ports became overridable (`TAS_HOST_BROKER_PORT`, `TAS_HOST_APP_PORT`,
  `TAS_HOST_NODERED_PORT`) without changing any default.
- **Phase 4 milestone gate** (#33): `test/e2e/modernised-workflow.test.js`
  drives the complete product workflow end to end on the modernised stack —
  define a topology, record data through a data recorder, replay the recorded
  dataset in a simulation, and read the report's score — and asserts
  pre-migration data stays readable, mid-simulation restarts leave `/status`
  reporting the truth, concurrent edits of one topology never discard each
  other, scoring still meets or exceeds its pre-migration baseline
  (`test/scoring-determinism.test.js`, `test/throughput-baseline.test.js`),
  and the dependency audit reports no unallowlisted high/critical advisories
  for the server manifest (`test/dependency-audit.test.js`).
- **Responsive dashboard layout** (#41): below the `md` breakpoint (768px)
  the header's section navigation collapses into a labelled, keyboard-operable
  dropdown; data tables scroll horizontally instead of stretching the page;
  the page shell tightens its margins and forms stack their labels on small
  screens.
- **Accessibility improvements** (#39): confirmation gates for destructive
  actions and request-state feedback on list views in the dashboard (#125).
- **E2E simulation lifecycle test** (#21): covers start, run, stop, restart
  and concurrent runs of the simulation and data-recorder lifecycles.

### Changed

- **Runtime run state is now persistent and shared** (#29): which simulations,
  data recorders and test campaigns are running used to live in module-level
  variables that a restart wiped and that grew without bound on stopped runs.
  All of it now flows through one registry (`src/server/runtime-state`)
  backed by `src/server/data/runtime-state.json` — written atomically under a
  lock, so two server processes on the same store observe one consistent view
  and a topology in use on one process is refused on the other. Operators see
  these behaviour changes:
  - after any restart the dashboard reports the true running state; work
    orphaned by an unclean shutdown is detected at boot, logged with its
    owner, and cleaned up automatically;
  - stopped entries are removed from `/status` rather than kept forever as
    `isRunning: false` placeholders (the stop responses still report the final
    state of what was just stopped);
  - starting a test campaign while one is already running is now a `409`
    conflict instead of silently orphaning the previous campaign.
    The store path can be moved with `TAS_RUNTIME_STATE_PATH`. No database is
    involved: tracking degrades to memory-only (with a warning) if the store is
    unwritable, so the status endpoints never depend on database health.

### Fixed

- **Recorder response crash** (#33): the recorder response endpoint no longer
  crashes on missing data; a phase-4 milestone gate was added to prevent
  regressions.

### Changed

- **Store topologies and recorders durably** (#30): topology and recorder data
  is now persisted to disk, surviving restarts.
- **Rename misspelled `evalulate` export** (#20): the evaluation module's
  export was corrected from `evalulate` to `evaluate`.
- **Remove redundant try/catch in `readJSONFileSync`** (#59): the no-op
  rethrow was removed for clarity.

### Tests

- **E2E storage root isolation** (#58): each e2e suite now runs against its
  own temporary storage root, eliminating cross-suite interference.

## [2.0.0] - 2026-08-24

The 2026 hardening and modernisation programme, cut as a major release: the
API now requires authentication on every endpoint and the single container
has been split into composed services, so upgrading deployments requires the
migration steps below. Everything in this release postdates the `v1.0.x`
tags, whose published images ship an unauthenticated API.

### Breaking Changes

- **API authentication**: every endpoint requires an authenticated session;
  single administrator account provisioned from configuration, session
  cookies, CSRF protection, login rate limiting (#64), asserted end-to-end
  (#66). The unauthenticated API served by `v1.0.x` images is gone —
  anonymous calls are rejected (#9).
- **Composed deployment**: the monolith image split into separate `app`,
  `broker` and `nodered` services wired by `docker compose`, each with its
  own health check and independent restart (#45, #114).
- **Node.js 24 LTS runtime**: pinned across manifests, image and CI (#32,
  #120); older runtimes are no longer built or published.
- **Dashboard build migrated from CRA to Vite** (#34, #89) and the compiled
  client bundle is no longer committed to the repository — it is produced at
  build time (#42, #90).

#### Upgrading from 1.0.x

1. Provision the single administrator account from configuration before
   exposing the service; sessions are cookie-based with CSRF protection and
   login rate limiting (#64, #97). Credential provisioning and the
   hardening configuration knobs are documented (#56, #97).
2. Deploy through the provided Compose topology so `app`, `broker` and
   `nodered` start together with their health checks (#45, #114); the app
   runs in production mode with explicit broker configuration (#46, #102).
3. Run on Node.js >= 24 (#32, #120).
4. If you build the dashboard from source, use the Vite build instead of CRA
   (#34, #89); no prebuilt bundle is shipped in the repository anymore
   (#42, #90).

### Security

Security fixes and hardening; several also appear above or under their
functional section below.

- **Filesystem containment**: name-derived file paths are contained and
  sanitised across models, devops and test-case routes (#50, #57).
- **CORS allowlist**: cross-origin access restricted to an explicit allowlist,
  same-origin compared by host (#52), with body-size caps and rate limiting.
- **Non-root container runtime** on a supported Node base image, supply-chain
  cleanup (#51).
- **Request validation**: parameters, query strings and bodies validated on
  every route (#60); correct HTTP status codes without internal error leakage
  (#61).
- **Content Security Policy** served explicitly via an upgraded helmet
  (#63) and enforced by default (#97).
- **Credential hygiene**: the database connector no longer logs credentials
  (#96).
- **Dependency advisory gate** blocking pull requests on high/critical
  production advisories (#101); jsoneditor advisories cleared by the v10
  upgrade (#117).

### Added

- Graceful shutdown: in-flight requests drained and the database closed on
  `SIGTERM`/`SIGINT` (#99).
- E2E security regression suite run on every push and pull request (#54),
  plus lint on pull requests and weekly Dependabot updates (#103).
- Test coverage suites for evaluation, data-sources and `/api/health` (#91);
  the real core suites now run in CI while fake `src` test scripts were
  retired (#124).
- Agent-runnable environment docs (`CLAUDE.md`, `AGENTS.md`) (#87).
- Client: confirmation gates for destructive actions and request-state
  feedback on list views (#125).

### Fixed

- Saving a data-storage configuration whose connection cannot be established
  is refused with a JSON 503 naming what failed, and the previous
  configuration stays on disk and live — it is no longer saved and reported
  as success (#18, #130); the dashboard's connection test and save path
  verify through the same connector seam.
- Simulation statistics responses hardened and the simulation update route
  answers 404 for unknown identifiers (#16, #129).
- Log router kind required and validated at mount time (#122).
- Numeric configuration parsing made explicit with dead code swept (#123).
- Model filename reported as written (#94).
- Logger no longer replaces global console methods (#95).
- Data-storage recovery path no longer crashes (#93).
- Dashboard failure notifications always render a readable message: caught
  errors are coerced at one boundary (`describeError`) instead of being
  stringified into `{}`, a malformed topology import names the failing file
  instead of failing silently, and raw error detail stays in the browser
  console (#40, #131).
- Client navigates client-side instead of triggering full page reloads
  (#36, #132).
- Container runs the app in production mode with explicit broker
  configuration (#102).
- Release workflow strips tag prefixes exactly when publishing images (#98).

### Performance

- Log reads bounded: `GET /api/logs/*/:fileName` streams any single-interval
  `Range: bytes=` request straight to the socket (206) and caps the default
  JSON envelope at the last `LOG_READ_MAX_BYTES` (1 MiB) of the file with
  additive `truncated`/`totalSize`/`returnedSize`/`offset` metadata (#85).
- Report list paginated: `GET /api/reports` accepts `limit` (default 50, max 500) and `skip`, answers `{reports, total, limit, skip}`, and the dashboard
  table pages server-side; report scoring reads events through a documented
  10000-event bound (#85, #31).
- File writes unblocked: the shared helper's collision check uses async
  `fs.access` instead of synchronous `fs.existsSync` on the request path
  (#85).
- Event writes batched: simulation events queue and flush as one `insertMany`
  on a size trigger (50 documents) or time trigger (200 ms); failed batches
  retry before being counted and reported through the logger and an `onDrop`
  hook — never lost silently; run shutdown drains the queue before closing
  the database client (#31).
- Hot-path scans removed: MQTT topic patterns are compiled once per pattern
  behind a bounded memo cache and once per sensor at registration, actuators
  are indexed by exact topic in a Map for constant-time lookup, and report
  scoring counts matches in linear time (multiset map for values, sorted
  interval sweep for timestamps) replacing an O(n·m) splice-in-loop (#31).
  Measured results are recorded in `BENCHMARKS.md`.

### Documentation

- Deployment security posture (#53) and hardening configuration knobs (#56),
  credential provisioning (#97), contributing guide, security policy
  correction and this changelog (#48), README authentication consistency
  (#86).

### Dependencies

- MongoDB layer migrated to mongoose v9 (#115).
- Helmet upgraded with an explicit Content Security Policy served by default
  (#63, #97).
- Dependency stack upgraded with body parser aligned to query parser (#100);
  vestigial Babel configuration removed (#121).
- Frontend stack uplifted: React/Router/Ant Design/testing-library major
  upgrades (#116), jsoneditor cleared on v10 (#117).

### Other

- Linting consolidated on ESLint + Prettier with a pre-commit hook (#88).
- Topology view rebuilt on d3 7, replacing react-d3-graph (#118).
- State layer moved to Redux Toolkit slices (#119).
- Server correctness sweep folded dead code removal into the parsing work
  (#123).

**Full Changelog**: https://github.com/Montimage/tas/compare/v1.0.3...v2.0.0

## [1.0.3] - 2024-02-16

Last tagged release before the 2026 programme. The published image tags
`v1.0`, `v1.0.2` (2024-02-15) and `v1.0.3` all **predate authentication**:
their API is unauthenticated, and they must not be exposed to untrusted
networks. No in-repo changelog existed before this file.

[Unreleased]: https://github.com/Montimage/tas/compare/v2.0.0...master
[2.0.0]: https://github.com/Montimage/tas/releases/tag/v2.0.0
[1.0.3]: https://github.com/Montimage/tas/releases/tag/v1.0.3
