import React from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ColDef,
  ICellRendererParams,
  RowClickedEvent,
  SelectionChangedEvent,
  ValidationModule,
  Theme,
  RowAutoHeightModule,
  ModuleRegistry,
  CellStyleModule,
  RenderApiModule,
} from "ag-grid-community";
import { Button, Link } from "@fluentui/react-components";
import { DocumentBulletList16Regular } from "@fluentui/react-icons";
import { type ExcelSheet } from "../utils/excelExport";

export interface EnvironmentGroupRow {
  environmentGroupId: string;
  id: string;
  displayName: string;
  description?: string;
  environmentCount: number;
  environmentNames: string[];
  isExpanded?: boolean;
  raw: Record<string, unknown>;
}

interface EnvironmentGroupsListProps {
  isLoading: boolean;
  error: string | null;
  isLoaded: boolean;
  rows: EnvironmentGroupRow[];
  theme: Theme | "legacy";
  onShowPolicies: (row: EnvironmentGroupRow) => void;
  onCompareSelectedGroups: (rows: EnvironmentGroupRow[]) => void;
}

export function createEnvironmentGroupsSheet(
  rows: EnvironmentGroupRow[],
): ExcelSheet {
  return {
    name: "Environment Groups",
    columns: [
      { header: "Name", width: 34 },
      { header: "ID", width: 38 },
      { header: "Description", width: 52 },
      { header: "Environment Count", width: 20 },
      { header: "Environments", width: 44 },
    ],
    rows: rows.map((row) => [
      row.displayName,
      row.id,
      row.description ?? "",
      row.environmentCount,
      row.environmentNames.join("\n"),
    ]),
  };
}

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function parseEnvironmentGroups(payload: unknown): EnvironmentGroupRow[] {
  let source: unknown = payload;

  if (source && typeof source === "object") {
    const src = source as { value?: unknown; objectResult?: unknown };
    if (Array.isArray(src.value)) {
      source = src.value;
    } else if (Array.isArray(src.objectResult)) {
      source = src.objectResult;
    }
  }

  if (!Array.isArray(source)) {
    if (source && typeof source === "object") {
      const item = source as Record<string, unknown>;
      const environmentGroupId =
        toText(
          item.environmentGroupId ?? item.id ?? item.groupId ?? item.name,
        ) || "unknown";
      const displayName =
        toText(
          item.displayName ??
            item.name ??
            item.title ??
            item.environmentGroupName,
        ) || environmentGroupId;
      return [
        {
          environmentGroupId,
          id: environmentGroupId,
          displayName,
          description: toText(item.description),
          environmentCount: 0,
          environmentNames: [],
          isExpanded: false,
          raw: item,
        },
      ];
    }

    return [];
  }

  return source
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        const text = toText(entry) || `Group ${index + 1}`;
        return {
          environmentGroupId: text,
          id: text,
          displayName: text,
          environmentCount: 0,
          environmentNames: [],
          isExpanded: false,
          raw: { value: entry },
        };
      }

      const item = entry as Record<string, unknown>;
      const environmentGroupId =
        toText(
          item.environmentGroupId ??
            item.id ??
            item.groupId ??
            item.name ??
            item.displayName,
        ) || `group-${index + 1}`;
      const displayName =
        toText(
          item.displayName ??
            item.name ??
            item.title ??
            item.environmentGroupName,
        ) || environmentGroupId;
      const description = toText(
        item.description ?? item.summary ?? item.shortDescription,
      );

      return {
        environmentGroupId,
        id: environmentGroupId,
        displayName,
        description: description || undefined,
        environmentCount: 0,
        environmentNames: [],
        isExpanded: false,
        raw: item,
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export function normalizeEnvironmentGroups(
  payload: unknown,
): EnvironmentGroupRow[] {
  return parseEnvironmentGroups(payload);
}
ModuleRegistry.registerModules([
  RowAutoHeightModule,
  ValidationModule,
  CellStyleModule,
  RenderApiModule,
]);

export function EnvironmentGroupsList(
  props: EnvironmentGroupsListProps,
): React.JSX.Element {
  const {
    isLoading,
    error,
    isLoaded,
    rows,
    theme,
    onShowPolicies,
    onCompareSelectedGroups,
  } = props;
  const [selectedRows, setSelectedRows] = React.useState<EnvironmentGroupRow[]>(
    [],
  );

  const toggleExpanded = React.useCallback(
    (
      row: EnvironmentGroupRow,
      params: {
        refreshCells: (opts: { force?: boolean }) => void;
        onRowHeightChanged: () => void;
      },
    ) => {
      row.isExpanded = !row.isExpanded;
      params.refreshCells({ force: true });
      params.onRowHeightChanged();
    },
    [],
  );

  const onRowClicked = React.useCallback(
    (event: RowClickedEvent<EnvironmentGroupRow>) => {
      const row = event.data;
      if (
        !row ||
        row.environmentCount === 0 ||
        row.environmentNames.length === 0
      ) {
        return;
      }

      const target = event.event?.target as HTMLElement | null;
      if (target?.closest("a,button,input,textarea,[role='button']")) {
        return;
      }

      toggleExpanded(row, event.api);
    },
    [toggleExpanded],
  );

  const onSelectionChanged = React.useCallback(
    (event: SelectionChangedEvent<EnvironmentGroupRow>) => {
      const selectedNodes = event.api.getSelectedNodes();
      if (selectedNodes.length > 2) {
        selectedNodes.slice(2).forEach((node) => node.setSelected(false));
      }

      const nextSelectedRows = event.api
        .getSelectedRows()
        .slice(0, 2) as EnvironmentGroupRow[];
      setSelectedRows(nextSelectedRows);
    },
    [],
  );

  const columnDefs = React.useMemo(
    () =>
      [
        {
          colId: "Details",
          headerName: "",
          width: 64,
          minWidth: 64,
          maxWidth: 64,
          sortable: false,
          filter: false,
          resizable: false,
          headerComponent: () => {
            const canCompare = selectedRows.length === 2;

            return (
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  justifyContent: "flex-start",
                  alignItems: "center",
                }}
              >
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<span aria-hidden="true">⇄</span>}
                  aria-label="Compare selected groups"
                  title={
                    canCompare
                      ? "Compare selected groups"
                      : "Select exactly two groups to compare"
                  }
                  disabled={!canCompare}
                  onClick={() => onCompareSelectedGroups(selectedRows)}
                />
              </div>
            );
          },
          cellRenderer: (params: ICellRendererParams<EnvironmentGroupRow>) => {
            const row = params.data;
            if (!row) {
              return null;
            }

            return row.environmentGroupId ? (
              <Button
                appearance="subtle"
                icon={<DocumentBulletList16Regular />}
                aria-label={`Show policies for ${row.displayName}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onShowPolicies(row);
                }}
              />
            ) : null;
          },
        },
        {
          field: "displayName",
          headerName: "Name",
          initialSort: "asc",
          flex: 1,
          minWidth: 220,
          filter: true,
          sortable: true,
          resizable: true,
        },
        {
          field: "id",
          headerName: "ID",
          flex: 1,
          minWidth: 240,
          filter: true,
          sortable: true,
          resizable: true,
        },
        {
          field: "description",
          headerName: "Description",
          flex: 2,
          minWidth: 280,
          filter: true,
          sortable: true,
          resizable: true,
        },
        {
          field: "environmentCount",
          headerName: "Environments",
          width: 220,
          minWidth: 220,
          filter: true,
          sortable: true,
          resizable: true,
          autoHeight: true,
          wrapText: true,
          cellStyle: {
            alignItems: "flex-start",
            paddingTop: "8px",
            paddingBottom: "8px",
          },
          cellRenderer: (
            params: ICellRendererParams<EnvironmentGroupRow, number>,
          ) => {
            const row = params.data;
            if (!row) {
              return null;
            }

            const count =
              typeof params.value === "number"
                ? params.value
                : row.environmentCount;
            const names = row.environmentNames;
            const canExpand = count > 0 && names.length > 0;
            const isExpanded = Boolean(row.isExpanded);

            if (!canExpand) {
              return <span>{count}</span>;
            }

            return (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  width: "100%",
                }}
              >
                <Link
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleExpanded(row, params.api);
                  }}
                >
                  {isExpanded ? `- (${count})` : `+ (${count})`}
                </Link>
                {isExpanded && (
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.4,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {names.map((name) => (
                      <div key={name}>{name}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          },
        },
      ] satisfies ColDef<EnvironmentGroupRow>[],
    [toggleExpanded, selectedRows, onCompareSelectedGroups],
  );

  if (isLoading) {
    return (
      <div className="info-box">
        <div className="loading">Loading environment groups from API...</div>
      </div>
    );
  }

  if (!isLoading && error) {
    return (
      <div className="info-box warning">
        <p>
          <strong>Unable to load environment groups</strong>
          <br />
          {error}
        </p>
      </div>
    );
  }

  if (isLoaded && rows.length === 0) {
    return (
      <div className="info-box">
        <div>No environment groups were returned by the tenant API.</div>
      </div>
    );
  }

  if (isLoaded) {
    return (
      <div className="env-grid-shell" style={{ flex: 1, minHeight: 0 }}>
        <AgGridReact<EnvironmentGroupRow>
          theme={theme}
          rowData={rows}
          columnDefs={columnDefs}
          rowSelection={{
            mode: "multiRow",
            checkboxes: true,
            headerCheckbox: false,
            enableClickSelection: false,
          }}
          onRowClicked={onRowClicked}
          onSelectionChanged={onSelectionChanged}
          domLayout="normal"
          enableCellTextSelection={true}
          ensureDomOrder={true}
        />
      </div>
    );
  }

  return (
    <div className="info-box">
      <div>Select the tab to load environment groups.</div>
    </div>
  );
}
