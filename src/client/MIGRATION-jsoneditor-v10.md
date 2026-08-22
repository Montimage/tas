# jsoneditor 8 → 10 upgrade — migration guide

Finding `F-DEP-105` (modernization plan task 5.5, issue #77): the dashboard's
model JSON editor ran on `jsoneditor` 8.6.6 — two majors behind — carrying a
moderate stored-XSS advisory and a moderate ReDoS advisory against an
operator-facing surface.

## Advisories closed

| Advisory | CVE | Class | Affected | Fixed | Severity |
|----------|-----|-------|----------|-------|----------|
| [GHSA-q854-j362-cfq9](https://github.com/advisories/GHSA-q854-j362-cfq9) | CVE-2020-23849 | Stored XSS in tree mode | < 9.0.2 | 9.0.2 | Moderate 6.1 |
| [GHSA-hhfg-6hfc-rvxm](https://github.com/advisories/GHSA-hhfg-6hfc-rvxm) | CVE-2021-3822 | ReDoS in `getInnerText` | < 9.5.6 | 9.5.6 | Moderate 5.3 |

Installed version: **10.4.3** (`^10.4.3` in `src/client/package.json`) — clears
both ranges.

## Migration sources

Upstream publishes its changelog as `HISTORY.md`; the copy shipped inside the
installed package (`src/client/node_modules/jsoneditor/HISTORY.md`, identical to
[the upstream file](https://github.com/josdejong/jsoneditor/blob/master/HISTORY.md))
is the authoritative source for every entry below. API semantics were checked
against the installed docs (`src/client/node_modules/jsoneditor/docs/api.md`).

## v8 → v9 (relevant entries)

| Version | Change | Impact here |
|---------|--------|-------------|
| 9.0.0 | New `limitDragging` option; breaking when a JSON schema is used — dragging becomes more restrictive by default (`limitDragging: false` restores old behaviour) | None — the dashboard never passes `schema` |
| 9.0.2 | **Fix #1029: XSS vulnerabilities** (upstream fix for GHSA-q854-j362-cfq9) | Primary security driver of this upgrade |
| 9.5.6 | ReDoS fix in `getInnerText` (fixes GHSA-hhfg-6hfc-rvxm, CVE-2021-3822) | Second security driver |
| 9.10.x | `showErrorTable` option; Ace/ajv/jsonrepair dependency refreshes | Informational |

## v9 → v10 (relevant entries)

| Version | Change | Impact here |
|---------|--------|-------------|
| 10.0.0 | **BREAKING: dropped Internet Explorer 11 support** — the *only* breaking change in v10 | None — Vite-built SPA, browserslist targets evergreen browsers |
| 10.1.x–10.4.x | Ace/`jsonrepair` upgrades, autocomplete improvements, `.validate()` always returns a Promise | Informational |

## Compatibility audit (installed 10.4.3 `docs/api.md`)

Single integration point: `src/client/src/components/JSONView/`
(`Editor.jsx` wraps the constructor; `JSONView.js` supplies props; used by
`ModelPage.js`, `DataRecorderPage.js`, `DataStoragePage.js`).

Every option and method the wrapper uses still exists in v10.4.3:

- Options: `onChange`, `onError`, `onModeChange`, `mode`, `name`, `schema`,
  `schemaRefs`, `ace`, `theme`, `history`, `navigationBar`, `statusBar`,
  `search`, `modes` (the wrapper maps React prop `allowedModes` → `modes`,
  unchanged).
- Methods: `set`, `get`, `getText`, `updateText`, `setName`/`getName`,
  `setSchema`, `destroy`, `collapseAll`, `expandAll`, `focus`.
- Behaviour note: `onChange` fires only on user edits — never on programmatic
  `set`/`setText`/`update`/`updateText` (api.md, `onChange`). Unchanged from v8,
  and relied upon by `Editor.handleChange`.

Result: **no production code change required for the bump itself** — the only
code touch was the React 18 lifecycle rename (`UNSAFE_componentWillReceiveProps`)
landed by the #35 dependency wave (PR #116), which carried the version bump.

## Verification performed (2026-08-22)

- `npm audit` in `src/client`: neither GHSA appears; remaining findings are the
  pre-existing low-severity `elliptic` crypto-browserify chain, unrelated to
  jsoneditor.
- Round-trip regression test added at
  `src/client/src/components/JSONView/JSONView.test.js`: loads a topology into a
  live v10 editor, propagates an edit through the documented change-handler seam
  into `onChange` (the payload ModelPage persists via export), and verifies
  teardown destroys the instance.
- Root suite baseline holds (≥ 285 passing, 0 failures).
