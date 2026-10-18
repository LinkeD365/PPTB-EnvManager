# Implementation

[Read the user guide](./README.md).

## Application structure

The tool is a React application built with Vite and TypeScript. `App.tsx` is the
composition root: it reads the active connections and host theme, creates the
Dataverse service, and passes these into the Environment Manager UI. Fluent UI
provides the application controls and AG Grid renders the settings and policy
tables. MobX holds the editable organization settings and comparison state.

The main implementation areas are:

- `src/App.tsx` — host connection and theme integration.
- `src/components/EnvManager.tsx` — tab coordination, loading, editing, and
  organization/environment settings saves.
- `src/components/OrgSettingsGrid.tsx`,
  `src/components/EnvironmentSettingsGrid.tsx`, and
  `src/components/PoliciesGrid.tsx` — editable and comparison grids.
- `src/utils/dataverse.tsx` — Dataverse organization settings reads and writes.
- `src/utils/environmentManagement.ts` and `src/utils/envMgmt.tsx` — Power
  Platform Environment Management and Governance API requests, response
  normalization, and rule metadata.
- `src/utils/excelExport.ts` — Excel, Markdown, and CSV exports.

## Host APIs and data

The application uses `window.toolboxAPI` for connections, host events,
notifications, theme information, and opening links in the connection browser.
It uses `window.dataverseAPI` to retrieve the current organization, read
`orgdborgsettings`, and update that organization record. Environment settings
and governance data are accessed through `window.powerplatformAPI` using the
Environment Management and Governance API categories with API version
`2024-10-01`.

Organization setting definitions and optional descriptions are loaded from the
two exact public GitHub XML resources declared in `cspExceptions`. Environment
API help and environment-group rule metadata are bundled with the tool; no
runtime request is made to this repository for those catalogs. The tool does
not send environment data to GitHub.

## Writes and exports

Changes are made only after a user edits values, selects Save, and confirms the
target and scope in the write confirmation dialog. Immediately before writing,
the tool re-reads the target organization settings, environment settings, or
environment-group policies and cancels if any reviewed current value has
changed. Organization settings saves merge the reviewed edits into the latest
`orgdborgsettings` values to preserve unrelated concurrent changes. Writes are
not an atomic compare-and-swap; a change made in the small interval after the
fresh read may still race with the update. Organization setting values are
XML-escaped and setting names validated before serialization. Environment-group
policy saves use fresh policy payloads for PUT/PATCH operations and warn that a
multi-request save may be partially applied if a later request fails.
After a successful policy save, reconciliation updates the current value to
the submitted value while preserving any newer draft, its pending edit state,
and its dependency-update flag. Drafts matching the saved value leave edit mode.

`src/utils/writeTarget.ts` verifies the current host connection slot after the
server preflight and immediately before every write, including every request
in a multi-request policy save. It also rechecks the live local target, reviewed
values, pending edits, and mounted state after awaiting the host connection
lookup. A mismatch cancels the remaining writes with a warning; inability to
verify the host connection surfaces as an error. The host lookup and write are
separate calls, not an atomic connection lock.

Organization XML reads treat null, empty, and whitespace-only values as an
empty settings collection. Populated XML must have an `OrgSettings` or
`orgSettings` root; both are accepted on reads, while writes retain the existing
`orgSettings` serialization.
Only child elements become settings. Formatting whitespace and comments are
ignored. Nested elements and setting attributes are rejected rather than
silently lost when the XML is rewritten. Loading an empty settings collection
still populates the editable catalog and clears previously loaded values.

Grid exports are user initiated and download data locally in Excel, Markdown,
or CSV format. They do not upload the exported data.
`EnvManager.tsx` registers AG Grid's `ClientSideRowModelApiModule` alongside the
row-model module so every grid can collect filtered, sorted rows through
`forEachNodeAfterFilterAndSort` for export registration and downloads.

## Connections, errors, and diagnostics

The manifest permits one to five Dataverse connections. Settings grids can
compare environments and save setting changes for an individual connection.
Governance operations use the primary connection in the current implementation.
API failures are surfaced through host notifications and the tool's event log;
connection refresh failures also show a notification.
For organization-settings troubleshooting, the raw `orgdborgsettings` XML is
logged before parsing to both the event-log callback and the PPTB Tool DevTools
console at info level, with the connection, slot, and organization identifiers.
This diagnostic includes setting values; review and redact it before sharing.
Policy loading clears stale rows when the primary connection changes and
surfaces failures both inline and through a host notification.

## Build and validation

Run these commands from the repository root:

```powershell
npm ci
npm run build
npm run validate
npm test
```

The production build emits a single bundled application in `dist` for loading
by PPTB. `npm test` runs the Node unit tests and all React component tests.
`npm run test:unit` runs focused write-confirmation and XML-serialization unit
tests. `npm run test:components` runs all component and TypeScript service suites, and
`npm run test:watch` runs those suites in watch mode. To run one component
suite, use:

```powershell
npm run test:components -- tests/components/basic-components.test.tsx
```

Component suite responsibilities:

- `tests/components/basic-components.test.tsx` — confirmation, filter, setting
  input, information popovers, exports, and the knowledge-source editor.
- `tests/components/grid-components.test.tsx` — environment groups, connectors,
  environment settings, and organization settings grids.
- `tests/components/composite-components.test.tsx` — policy and main
  Environment Manager screens.
- `tests/components/settings-save-safety.test.tsx` — connected organization and
  environment saves, deferred preflight reads, connection changes, pending
  edits, and unmount cancellation.
- `tests/components/policy-save-safety.test.tsx` — policy PUT/PATCH target
  verification, cancellation between requests, group changes, load errors, and
  preserving newer drafts and dependency flags during the final write.
- `tests/services/dataverse.test.ts` — empty, formatted, commented, malformed,
  and unsupported organization XML, and safe serializer round-tripping.
- `tests/services/writeTarget.test.ts` — slot-aware host verification and local
  review changes while the host lookup is pending.
- `tests/services/grid-export.test.ts` — real AG Grid API regression coverage
  for module registration and filtered, sorted export rows. Run it with
  `npm run test:components -- tests/services/grid-export.test.ts`.
- `tests/helpers/deferred.ts` — controlled promises for asynchronous regression
  tests; this helper is outside test discovery.
- `tests/components/setup.ts` — shared cleanup and AG Grid test double.

Run the blocker regression suites with:

```powershell
npm run test:components -- tests/services tests/components/settings-save-safety.test.tsx tests/components/policy-save-safety.test.tsx
```

Component tests use jsdom and an AG Grid test double, so they cover component
states, accessible interactions, and export registration without depending on
the PPTB host. Build and manifest validation do not replace acceptance testing
in PPTB against a real environment, including permissions, realistic data
volumes, and both light and dark themes.

List responses containing a standard `nextLink`, `nextPageLink`, or
`@odata.nextLink` are rejected rather than displayed as complete. The tool does
not yet follow continuation links because the current ToolBox API client
contract for those Power Platform endpoints has not been confirmed. Verify the
documented paging contract and list completeness against the current API in a
real tenant before making completeness claims.

## Required live acceptance before submission

The maintainer confirmed on 2026-10-18 that the human checks passed inside PPTB
against a real environment; see the [human testing results](./README.md#human-testing).
This is a maintainer-reported result, not independent verification by the
automated suite. The PPTB version, environment type, and execution date were
not supplied. Retain the checklist below for subsequent releases and run
write tests against a non-production environment. Automated tests do not
replace these checks.

- Load the packaged tool with one and multiple connections in light and dark
  themes; check the icon, grids, and five-line read-only confirmation preview.
- Load an organization with no overrides and one with formatted settings XML.
  Export current values, save a test setting, reload, verify unrelated settings,
  and restore the original value.
- Repeat the export/save/reload/restore flow for environment settings and
  governance rule sets and policies, including a multi-request save.
- Switch or remove a connection while a pre-save read is pending; verify no
  write reaches an unreviewed target. Repeat between policy requests and verify
  the partial-application warning and already-applied values.
- Exercise insufficient privileges, service errors, concurrent value changes,
  and realistic list volumes. Confirm errors are visible and continuation
  responses are not represented as complete lists.
- Record the PPTB version, environment type, test date, results, and any failed
  cases before claiming marketplace readiness.
