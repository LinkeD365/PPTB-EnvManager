# Environment Manager

![Environment Manager screenshot](https://github.com/LinkeD365/PPTB-EnvManager/blob/main/public/mainscreenshot.png?raw=true)

A Power Platform Tool Box tool which allows you to edit some behind the scenes settings for Dataverse environments

## Features

- ✅ Organization Settings tab (OrgDbOrgSettings) for classic org-level flags
- ✅ Environment Settings API tab for modern environment-level settings
- ✅ Environment Groups and policy comparison workflows for governance rule review
- ✅ Compare Environment Groups highlighting differences
- ✅ Compare Connectors in Environment Groups highlighting differences
- ✅ Compare up to 5 connected environments side-by-side
- ✅ Rule-based policy and rule set updates through the Power Platform Governance APIs
- ✅ Excel export for individual grids or all loaded grids in one workbook
- ✅ Inline setting guidance from Microsoft, LinkeD365, and governance metadata sources
- ✅ Automatic fallback when Environment Management API is unavailable

## Credits

The Organization Settings experience is based on Sean McNellis's
[OrgDbOrgSettings](https://github.com/seanmcne/OrgDbOrgSettings), released under
the [MIT License](https://github.com/seanmcne/OrgDbOrgSettings/blob/master/LICENSE).
Additional setting descriptions are loaded from
[LinkeD365/OrgSettings](https://github.com/LinkeD365/OrgSettings), licensed
under [GPL-2.0](https://github.com/LinkeD365/OrgSettings/blob/master/LICENSE).
Environment settings, environment-group governance, comparison, and export
features are additional functionality in this tool.

## Usage

After connecting one or more Dataverse environments, choose a settings or
governance view to compare and edit the available values.

Select the Edit icon beside a value, make the change, and select Save. Review
the target and listed changes in the confirmation dialog before confirming.

Tabs are available if you have included a connection to the Power Platform API to allow configuration of Environment Groups and policy management.

## CSP Requirements

The tool requests these exact public GitHub resources:

- Required organization setting definitions:
  <https://raw.githubusercontent.com/seanmcne/OrgDbOrgSettings/master/mspfedyn_/OrgDbOrgSettings/Solution/WebResources/mspfedyn_/OrgDbOrgSettings/Settings.xml>
- Optional additional setting descriptions:
  <https://raw.githubusercontent.com/LinkeD365/OrgSettings/master/LinkeD65OrgSettings.xml>

Environment API help and governance metadata are bundled with the tool. No
environment, organization, user, or exported data is sent to these GitHub
resources.

## New Functionality

### Environment Settings API Support

The tool loads settings from the Power Platform Environment Management endpoint and shows them in a dedicated **Environment Settings API** tab.

- Reads settings by environment id automatically for the active connection
- Supports compare mode when additional connections (up to 5 in total) are selected
- Tracks edits per row and only saves changed values
- Handles `boolean`, `text`, `number`, and `not set` values
- Blocks edits for non-editable fields such as `Id` and `TenantId`

### Multi-Connection Save Flow

Both settings experiences support side-by-side compare. Each connection has its own save action so you can:

- Save only primary changes
- Save only the changes for any other connection
- Keep other connections unchanged while validating one

### Environment Groups and Policy Management

The tool also includes an **Environment Groups** experience for reviewing and updating governance policy configuration.

- Lists environment groups and their assigned policies
- Compares policy values across groups when needed
- Surfaces rule metadata, display names, preview flags, and docs links
- Updates rule-based policies and rule sets using the Power Platform Governance API contract
- Validates and coerces value types before sending updates to avoid schema errors

### Policy Metadata and Help Content

Rule metadata is loaded from the governance UI configuration and the bundled
fallback JSON catalog to provide friendly labels, descriptions, and learn-more
links where available.

- Shows policy help text and docs links in the info popup
- Hides empty learn-more links automatically
- Keeps policy names readable when metadata is incomplete

### Grid Export

Each settings, environment group, policy, and connector grid can be exported as
Excel, Markdown, or CSV. Combined Excel exports create a separate worksheet for
every loaded grid, combined Markdown exports create a section per grid, and
combined CSV exports download one file per grid. Exports preserve the current
comparison and difference-filter context.

## Notes

- If Environment Management API calls fail for a connection, the Organization Settings experience is still available.
- Some environment settings and governance rules are service-managed and may not be editable.
- Policy update payloads are type-aware to match the expected governance schema.

## What this tool changes

No changes are made when the tool loads. After you review the displayed values,
selecting Save and confirming the target and listed scope can:

- Update the selected Dataverse organization's `orgdborgsettings` XML field.
- Update selected environment settings through the Environment Management API.
- Update rule sets or rule-based policies for the selected environment group.

The confirmation dialog identifies the connection and organization, environment,
or environment group, and lists the current and proposed values.
There is no in-tool undo. Export or record current values before saving if you
may need to restore them. A multi-request policy save may be partially applied
if a later request fails. Immediately before saving, the tool re-reads the
reviewed server values and cancels if they changed; organization setting writes
preserve unrelated values from the latest read.
After that read, each write also rechecks the host's selected connection and
the reviewed local target and edits. A detected connection or edit change
cancels the save; for multi-request saves, earlier requests may already have
applied. Reload and review the current values before trying again.

## Human testing

**Passed - maintainer-confirmed on 2026-10-18.** The maintainer confirmed
that a person completed and passed all checks below inside PPTB against a real
environment. These are human-reported results, not conclusions drawn from
automated tests. The PPTB version, environment type, and execution date were
not supplied with this confirmation.

- [x] Load the packaged tool with one and multiple connections.
- [x] Check the icon, grids, and full-width, five-line, scrollable read-only
  confirmation preview in both light and dark themes.
- [x] Load organizations with no settings overrides and with formatted settings
  XML; verify the available settings and displayed values.
- [x] Export organization settings, save a test change, reload, verify unrelated
  settings are preserved, and restore the original value.
- [x] Export environment settings, save a test change, reload, verify the result,
  and restore the original value.
- [x] Export governance values, save rule set and rule-based policy changes,
  reload, verify the results, and restore the original values.
- [x] Exercise a multi-request policy save, including partial application and
  its warning when a later request cannot proceed.
- [x] Switch or remove connections during pre-save validation and between policy
  requests; verify remaining writes do not reach an unreviewed target.
- [x] Change pending edits or server values after review; verify stale saves
  are cancelled and require another review.
- [x] Exercise missing permissions, expired or removed connections, service
  failures, and empty results; verify errors are visible.
- [x] Check realistic data volumes and paging behavior; verify recognized
  continuation responses are rejected rather than shown as complete lists.

Pagination is not implemented; passing the paging check confirms safe rejection,
not support for loading every page. Repeat these checks after changes affecting
the tested behavior.

## AI assistance disclosure

AI assistance was used to implement and review portions of this tool, including
write confirmations and automated tests. The maintainers remain responsible for
reviewing and testing all code and behavior before release.

## Implementation

For the technical architecture, API integrations, write behavior, and build
validation commands, see the [implementation reference](./IMPLEMENTATION.md).

## Installation

Use the Power Platform Toolbox to install
<https://www.powerplatformtoolbox.com/>

## License

MIT
