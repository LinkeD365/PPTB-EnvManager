# Environment Manager

A Power Platform Tool Box tool which allows you to edit some behind the scenes settings for Dataverse environments

## Features

- ✅ Organization Settings tab (OrgDbOrgSettings) for classic org-level flags
- ✅ Environment Settings API tab for modern environment-level settings
- ✅ Environment Groups and policy comparison workflows for governance rule review
- ✅ Compare Environment Groups highlighting differences
- ✅ Compare Connectors in Environment Groups highlighting differences
- ✅ Compare primary and secondary environments side-by-side
- ✅ Rule-based policy and rule set updates through the Power Platform Governance APIs
- ✅ Excel export for individual grids or all loaded grids in one workbook
- ✅ Inline setting guidance from Microsoft, LinkeD365, and governance metadata sources
- ✅ Automatic fallback when Environment Management API is unavailable

Tool is based on Sean McNellis original tool <https://github.com/seanmcne/OrgDbOrgSettings>

## New Functionality

### Environment Settings API Support

The tool loads settings from the Power Platform Environment Management endpoint and shows them in a dedicated **Environment Settings API** tab.

- Reads settings by environment id automatically for the active connection
- Supports compare mode when a secondary connection is selected
- Tracks edits per row and only saves changed values
- Handles `boolean`, `text`, `number`, and `not set` values
- Blocks edits for non-editable fields such as `Id` and `TenantId`

### Dual-Connection Save Flow

Both settings experiences support side-by-side compare. Each connection has its own save action so you can:

- Save only primary changes
- Save only secondary changes
- Keep one side unchanged while validating the other

### Environment Groups and Policy Management

The tool also includes an **Environment Groups** experience for reviewing and updating governance policy configuration.

- Lists environment groups and their assigned policies
- Compares policy values across groups when needed
- Surfaces rule metadata, display names, preview flags, and docs links
- Updates rule-based policies and rule sets using the Power Platform Governance API contract
- Validates and coerces value types before sending updates to avoid schema errors

### Policy Metadata and Help Content

Rule metadata is loaded from the governance UI configuration and a local fallback JSON file to provide friendly labels, descriptions, and learn-more links where available.

- Shows policy help text and docs links in the info popup
- Hides empty learn-more links automatically
- Keeps policy names readable when metadata is incomplete

### Excel Export

Each settings, environment group, policy, and connector grid can be exported to
an Excel workbook. Combined exports create a separate worksheet for every
loaded grid and preserve the current comparison and difference-filter context.


## Notes

- If Environment Management API calls fail for a connection, the Organization Settings experience is still available.
- Some environment settings and governance rules are service-managed and may not be editable.
- Policy update payloads are type-aware to match the expected governance schema.

## Installation

Use the Power Platform Toolbox to install
<https://www.powerplatformtoolbox.com/>

## License

MIT
