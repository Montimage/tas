# TaS — Test and Simulation Enabler

> **Two-manifest layout.** This file (`CLAUDE.md`) covers build commands, architecture, and hard rules. `AGENTS.md` complements it with subagent definitions for automated workflows. Together they let an agent or new contributor reach a running server from the repo alone.

## Environment

- **Node.js:** v24.11.1 (system default). The project has **no version pinning** — no `.nvmrc`, `.node-version`, or `engines` field in `package.json`. Use a compatible Node 18+ runtime.

## Critical Commands

```
npm ci                          # install root dependencies (production only)
npm ci --prefix src/client      # install client dependencies
npm run build --prefix src/client   # build the React dashboard → src/public
npm test                        # run full test suite (node --test-concurrency=1 --test "test/**/*.test.js")
npm run start                   # start production server (NODE_ENV=production)
npm run server                  # start dev server with nodemon hot-reload
```

**No root `build` script exists.** The client build is `npm run build --prefix src/client`
and writes to `src/public/`. This is the single fact whose absence produced the stale-bundle
defect (F-BUG-001).

## Architecture Map

| Path              | Role                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `src/server/`     | Express API — routes, middleware, config, auth, logger                                      |
| `src/core/`       | Simulation engine — things, gateways, sensors, communications, evaluation, Mongoose schemas |
| `src/client/src/` | React dashboard (CRA 3, antd 4) — pages, components, reducers, sagas, API layer             |
| `src/public/`     | **Generated build output from `src/client`. Never edit manually.**                          |
| `test/`           | All automated tests (node:test, ~286 cases)                                                 |

## Hard Rules

- **`src/public/` is generated.** It is the build output of `src/client`. Never edit files
  here by hand — rebuild from `src/client/src` instead.
- **`src/core/**/*.test.js` are NOT real tests.** They are ad-hoc scripts that open a live MongoDB and use no assertion framework. The `npm test` glob (`test/**/*.test.js`) never
  runs them. Do not treat them as coverage.
- **Lint is currently inoperable.** `.eslintrc.json` extends `"airbnb"` which is not installed.
  `npm run lint` will fail with a config error. Do not assume lint passes.
- **Never commit `.env`.** It is gitignored and contains credentials. Use `cp env.example .env`
  to provision locally. The one-liner to generate a password hash is:
  `node -e "console.log(require('./src/server/auth/passwords').hashPassword(process.argv[1]))" 'password'`
- **`npm test` must pass at ≥ 285/286** (1 conditional skip) after any change. This is the
  baseline-green constraint from the modernization plan.
- **The client has no root-level tooling.** All client commands require `--prefix src/client`.

## Workflow Preferences

- Run `npm test` after changes, but prefer targeted runs (`--test-name-pattern="..."`) for speed.
- E2E tests are serialised (`--test-concurrency=1`) because each spawns a real server instance.
- When the README and code disagree, the README is stale — follow the code.

## Token Efficiency

- Never re-read files you just wrote or edited. You know the contents.
- Never re-run commands to "verify" unless the outcome was uncertain.
- Don't echo back large blocks of code or file contents unless asked.
- Batch related edits into single operations. Don't make 5 edits when 1 handles it.
- Skip confirmations like "I'll continue..." Just do it.
- If a task needs 1 tool call, don't use 3. Plan before acting.
- Do not summarize what you just did unless the result is ambiguous or you need additional input.
