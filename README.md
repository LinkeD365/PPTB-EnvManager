# Environment Manager

A Power Platform Tool Box tool which allows you to edit some behind the scenes settings for Dataverse environments

## Features

- ✅ Organization Settings tab (OrgDbOrgSettings) for classic org-level flags
- ✅ Environment Settings API tab for modern environment-level settings
- ✅ Enable/disable boolean settings and edit text/number values
- ✅ Compare primary and secondary environments side-by-side
- ✅ Save primary and secondary changes independently from each grid
- ✅ Inline setting guidance from Microsoft and LinkeD365 sources
- ✅ Automatic fallback when Environment Management API is unavailable

Tool is based of Sean McNellis original tool <https://github.com/seanmcne/OrgDbOrgSettings>

## New Functionality

### Environment Settings API Support

The tool now loads settings from the Power Platform Environment Management endpoint and shows them in a dedicated **Environment Settings API** tab.

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

### Setting Metadata

For Environment Settings API rows, additional descriptions and docs links are loaded from [PPApiInfo.json](PPApiInfo.json) and shown in the grid info popup.

## Notes

- If Environment Management API calls fail for a connection, the Organization Settings experience is still available.
- Some environment settings are service-managed and may not be editable.

## Installation

Use the Power Platform Toolbox to install
<https://www.powerplatformtoolbox.com/>

## License

MIT
