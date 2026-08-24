# Changelog

All notable changes to TaS are documented in this file. Releases are cut as
`v*` tags and published as the `ghcr.io/montimage/tas` container image (stable
`vX.Y.Z` tags also move the `latest` tag). The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

The 2026 hardening and modernisation programme. No release tag has been cut
from this work yet — everything below is on `master`, and the newest published
image tags (`v1.0.x`) still predate all of it.

### Security

Security fixes and hardening are listed here explicitly; each also appears
under its functional section below.

- **API authentication**: every endpoint requires an authenticated session;
  single administrator account provisioned from configuration, session
  cookies, CSRF protection, login rate limiting (#64), asserted end-to-end
  (#66).
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

- Composed deployment: the monolith image split into separate `app`, `broker`
  and `nodered` services wired by `docker compose`, each with its own health
  check and independent restart (#114).
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

### Changed

- Dashboard build migrated from CRA to Vite (#89); the compiled client bundle
  is no longer committed and is produced at build time (#90).
- Frontend stack uplifted: React/Router/Ant Design/testing-library major
  upgrades (#116), topology view rebuilt on d3 7 replacing react-d3-graph
  (#118), state layer moved to Redux Toolkit slices (#119).
- MongoDB layer migrated to mongoose v9 (#115).
- Runtime pinned to Node.js 24 LTS across manifests, image and CI (#120).
- Linting consolidated on ESLint + Prettier with a pre-commit hook (#88).
- Dependency stack upgraded with body parser aligned to query parser (#100);
  vestigial Babel configuration removed (#121).
- Container runs the app in production mode with explicit broker
  configuration (#102).
- Server correctness: log router kind required and validated at mount time
  (#122); numeric configuration parsing made explicit with dead code swept
  (#123); model filename reported as written (#94); logger no longer replaces
  global console methods (#95); data-storage recovery path no longer crashes
  (#93); saving a data-storage configuration whose connection cannot be
  established is refused with a JSON 503 naming what failed, and the previous
  configuration stays on disk and live — it is no longer saved and reported as
  success (#18); the dashboard's connection test and save path verify through
  the same connector seam.
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
- Documentation: deployment security posture (#53) and hardening
  configuration knobs (#56), credential provisioning (#97), contributing
  guide, security policy correction and this changelog (#48), README
  authentication consistency (#86).

## [1.0.3] - 2024-02-16

Last tagged release before the 2026 programme. The published image tags
`v1.0`, `v1.0.2` (2024-02-15) and `v1.0.3` all **predate authentication**:
their API is unauthenticated, and they must not be exposed to untrusted
networks. No in-repo changelog existed before this file.

[Unreleased]: https://github.com/Montimage/tas/compare/v1.0.3...master
[1.0.3]: https://github.com/Montimage/tas/releases/tag/v1.0.3
