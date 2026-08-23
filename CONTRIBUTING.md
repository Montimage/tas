# Contributing to TaS

Thank you for considering a contribution. This guide covers setting the
project up, running the tests and submitting a change.

## Getting started

The runtime is pinned to **Node.js 24 LTS** (`.nvmrc`); both manifests declare
it under `engines`. With Node 24 active:

```
git clone git@github.com:Montimage/tas.git
cd tas
npm install
```

The web dashboard under `src/client/` is built with Vite and emitted to
`src/public/`, which the server serves at `/`. The compiled bundle is not
committed, so build it once after installing dependencies:

```
cd src/client
npm install
npm run build      # emits to ../public (i.e. src/public)
npm run dev        # instead of build, for local development with hot reload
cd ../..
```

To run the application locally, create a `.env` from `env.example` and
provision an administrator credential — every API endpoint requires an
authenticated session. The exact steps are in the
[README](README.md#install-from-source-code) (install-from-source section and
[Provisioning the administrator credential](README.md#provisioning-the-administrator-credential)).

## Running the tests

```
npm test
```

runs everything under `test/` serialised (`--test-concurrency=1`, because some
end-to-end files each spawn their own real server instance). A full run takes
roughly half a minute; a change is only ready when the whole suite passes.

The E2E security regression suite can also be driven on its own — HTTP
assertions (path containment, name sanitisation, CORS, rate/body limits,
legitimate flows) and a non-root container check:

```
node --test-concurrency=1 --test test/e2e/security-suite.test.js test/e2e/limits.test.js

docker build -t montimage/tas:e2e .
TAS_IMAGE=montimage/tas:e2e node --test test/e2e/container-nonroot.test.js
```

## Lint and format

Linting is ESLint; formatting is Prettier:

```
npm run lint        # eslint .
npm run lint:fix    # eslint --fix
npm run format:check
npm run format      # prettier --write
```

A Husky pre-commit hook runs ESLint and Prettier on staged files via
`lint-staged`.

## Submitting a change

- Branch from `master`; name branches after the issue they resolve, e.g.
  `fix/42-short-description`, `feat/N-...`, `docs/N-...`.
- Write [conventional commits](https://www.conventionalcommits.org/) with the
  issue reference, one logical change per commit:
  `fix(auth): resolve redirect loop (#42)`.
- Open a pull request that describes what changed and why, and reference the
  issue it closes (`Closes #N`).
- Keep the full test suite passing and add or extend tests for behaviour you
  change.

### Continuous integration

Every pull request runs the **E2E Security Regression Suite** workflow:

- the full test suite plus end-to-end assertions over HTTP,
- `eslint`,
- a gate on high/critical advisories in production dependencies
  (`scripts/audit-gate.js`),
- an assertion that the built container image runs as a non-root user.

A pull request is mergeable only when all of these pass. Dependency updates
for both manifests (the server root and the dashboard client) are proposed
weekly by Dependabot.

## Reporting security issues

Please do **not** open public issues for undisclosed vulnerabilities — report
them privately as described in [SECURITY.md](SECURITY.md).
