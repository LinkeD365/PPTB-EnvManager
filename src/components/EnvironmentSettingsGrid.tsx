import React from "react";
import {
  ArrowUndoRegular,
  EditRegular,
  Save20Filled,
} from "@fluentui/react-icons";
import { Button, Badge, Input, Switch } from "@fluentui/react-components";
import { AgGridReact } from "ag-grid-react";
import { CustomCellRendererProps, CustomInnerHeaderProps } from "ag-grid-react";
import { ColDef, ColGroupDef, Theme } from "ag-grid-community";
import { EnvironmentInfoPopup } from "./EnvironmentInfo";
import { comparisonValuesDiffer } from "./ComparisonFilterButton";
import {
  getDisplayedGridRows,
  type ExcelSheet,
  type GridExportRegistration,
} from "../utils/excelExport";

export type EnvSettingValue = string | number | boolean | null;

export function getEnvSlotCurrent(row: EnvApiGridRow, slot: number): EnvSettingValue | undefined {
  return slot === 0 ? row.current : row.others?.[slot]?.current;
}

export function getEnvSlotNew(row: EnvApiGridRow, slot: number): EnvSettingValue | undefined {
  return slot === 0 ? row.new : row.others?.[slot]?.new;
}

// Slots 1..n that have a connection name (index = connection slot).
function getComparedSlots(connectionNames: Array<string | undefined>) {
  return connectionNames
    .map((name, slot) => (slot > 0 && name ? slot : -1))
    .filter((slot) => slot > 0);
}

function rowDiffers(row: EnvApiGridRow, slots: number[]): boolean {
  return slots.some(
    (slot) =>
      comparisonValuesDiffer(row.current, getEnvSlotCurrent(row, slot)) ||
      comparisonValuesDiffer(row.new, getEnvSlotNew(row, slot)),
  );
}

export interface EnvApiGridRow {
  property: string;
  current: EnvSettingValue;
  new: EnvSettingValue;
  others?: Array<{ current: EnvSettingValue; new: EnvSettingValue } | undefined>;
  shortDescription?: string;
  link?: string;
  edit: boolean;
  valueType: "boolean" | "text" | "number";
  editable?: boolean;
}

interface EnvironmentSettingsGridProps {
  isLoading: boolean;
  error: string | null;
  isLoaded: boolean;
  rows: EnvApiGridRow[];
  connectionNames: Array<string | undefined>;
  showOnlyDifferences: boolean;
  theme: Theme | "legacy";
  savingSlots: boolean[];
  pendingSlots: boolean[];
  onToggleEdit: (property: string, edit: boolean) => void;
  onNewValueChange: (
    property: string,
    nextValue: EnvSettingValue,
    slot?: number,
  ) => void;
  onSave: (slot: number) => void;
  onExportRegistration?: (registration: GridExportRegistration) => void;
}

export function createEnvironmentSettingsSheet(
  rows: EnvApiGridRow[],
  connectionNames: Array<string | undefined>,
  showOnlyDifferences = false,
): ExcelSheet {
  const slots = getComparedSlots(connectionNames);
  const exportRows =
    slots.length > 0 && showOnlyDifferences
      ? rows.filter((row) => rowDiffers(row, slots))
      : rows;
  const allSlots = [0, ...slots];

  return {
    name: "Environment Settings",
    columns: [
      { header: "Property", width: 42 },
      ...allSlots.flatMap((slot) => {
        const name = connectionNames[slot] ?? "Primary Connection";
        return [
          { header: `${name} - Current`, width: 28 },
          { header: `${name} - New`, width: 28 },
        ];
      }),
    ],
    rows: exportRows.map((row) => [
      row.property,
      ...allSlots.flatMap((slot) =>
        slot === 0
          ? [row.current, row.new]
          : [
              getEnvSlotCurrent(row, slot) ?? "",
              getEnvSlotNew(row, slot) ?? "",
            ],
      ),
    ]),
  };
}

export const EnvironmentSettingsGrid = (
  props: EnvironmentSettingsGridProps,
): React.JSX.Element => {
  const {
    isLoading,
    error,
    isLoaded,
    rows,
    connectionNames,
    showOnlyDifferences,
    theme,
    savingSlots,
    pendingSlots,
    onToggleEdit,
    onNewValueChange,
    onSave,
    onExportRegistration,
  } = props;
  const gridRef = React.useRef<AgGridReact<EnvApiGridRow>>(null);
  const connectionNamesKey = JSON.stringify(connectionNames);
  const comparedSlots = getComparedSlots(connectionNames);
  const hasComparison = comparedSlots.length > 0;
  const visibleRows =
    hasComparison && showOnlyDifferences
      ? rows.filter((row) => rowDiffers(row, comparedSlots))
      : rows;
  const registerExport = React.useCallback(() => {
    const api = gridRef.current?.api;
    if (!api || !onExportRegistration) {
      return;
    }

    onExportRegistration({
      id: "environment-settings",
      contextKey: connectionNamesKey,
      rowCount: getDisplayedGridRows(api).length,
      getSheet: () =>
        createEnvironmentSettingsSheet(
          getDisplayedGridRows(api),
          (JSON.parse(connectionNamesKey) as Array<string | null>).map(
            (n) => n ?? undefined,
          ),
        ),
    });
  }, [connectionNamesKey, onExportRegistration]);

  React.useEffect(registerExport, [registerExport]);

  const formatCurrentValueText = React.useCallback(
    (value: EnvSettingValue): string => {
      if (value === null || value === undefined) {
        return "";
      }
      if (typeof value === "boolean") {
        return value ? "true" : "false";
      }
      return String(value);
    },
    [],
  );

  const getCompareCellStyle = React.useCallback(
    (leftValue: EnvSettingValue, rightValues: Array<EnvSettingValue | undefined>) => {
      const leftText =
        leftValue === null || leftValue === undefined ? "" : String(leftValue);
      const differs = rightValues.some(
        (rightValue) =>
          rightValue !== undefined &&
          (rightValue === null ? "" : String(rightValue)) !== leftText,
      );

      if (!hasComparison || !differs) {
        return undefined;
      }

      return {
        backgroundColor: "rgba(255, 193, 7, 0.18)",
        borderLeft: "3px solid #ffbf00",
      };
    },
    [hasComparison],
  );

  const renderCompactValue = React.useCallback(
    (value: EnvSettingValue) => {
      const text = formatCurrentValueText(value);
      return (
        <span className="env-grid-value" title={text}>
          {text}
        </span>
      );
    },
    [formatCurrentValueText],
  );

  const createSaveHeader = (slot: number) =>
    function SaveHeader(params: CustomInnerHeaderProps<EnvApiGridRow>) {
      return (
        <div
          className="customInnerHeaderGroup"
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            minWidth: 0,
          }}
        >
          <div className="env-grid-header-label" title={params.displayName}>
            {params.displayName}
          </div>
          {pendingSlots[slot] && (
            <Button
              icon={<Save20Filled />}
              disabled={savingSlots[slot]}
              onClick={() => onSave(slot)}
            />
          )}
        </div>
      );
    };

  const renderValueControl = React.useCallback(
    (
      row: EnvApiGridRow,
      value: EnvSettingValue,
      onChange: (nextValue: EnvSettingValue) => void,
      inputReadOnly = false,
    ) => {
      if (row.valueType === "boolean") {
        if (value === null) {
          return (
            <Switch
              checked={false}
              disabled={inputReadOnly}
              label="Not set"
              onChange={(_, data) => onChange(data.checked)}
            />
          );
        }

        return (
          <Switch
            checked={Boolean(value)}
            disabled={inputReadOnly}
            label={Boolean(value) ? "Enabled" : "Disabled"}
            onChange={(_, data) => onChange(data.checked)}
          />
        );
      }

      if (value === null) {
        if (inputReadOnly) {
          return <Badge appearance="outline">Not set</Badge>;
        }

        if (row.valueType === "number") {
          return (
            <Input
              type="number"
              value=""
              placeholder="Not set"
              appearance="outline"
              style={{ width: "100%" }}
              onChange={(_, data) => {
                if (data.value.trim() === "") {
                  onChange(null);
                  return;
                }
                const parsed = Number(data.value);
                onChange(Number.isNaN(parsed) ? null : parsed);
              }}
            />
          );
        }

        return (
          <Input
            value=""
            placeholder="Not set"
            appearance="outline"
            style={{ width: "100%" }}
            onChange={(_, data) => onChange(data.value)}
          />
        );
      }

      if (row.valueType === "number") {
        return (
          <Input
            type="number"
            value={String(value)}
            readOnly={inputReadOnly}
            appearance="outline"
            style={{ width: "100%" }}
            onChange={(_, data) => {
              if (data.value.trim() === "") {
                onChange(null);
                return;
              }
              const parsed = Number(data.value);
              onChange(Number.isNaN(parsed) ? null : parsed);
            }}
          />
        );
      }

      return (
        <Input
          value={String(value)}
          readOnly={inputReadOnly}
          appearance="outline"
          style={{ width: "100%" }}
          onChange={(_, data) => onChange(data.value)}
        />
      );
    },
    [],
  );

  const resolvedColumnDefs = React.useMemo(() => {
    const getOtherValues = (
      row: EnvApiGridRow | undefined,
      slot: number,
      kind: "current" | "new",
    ): Array<EnvSettingValue | undefined> => {
      if (!row) {
        return [];
      }
      const get = kind === "current" ? getEnvSlotCurrent : getEnvSlotNew;
      // Slot 0 is compared against every other slot, others against slot 0.
      return slot === 0
        ? comparedSlots.map((s) => get(row, s))
        : [get(row, 0) ?? undefined];
    };

    const slotHeaders = (slot: number): ColGroupDef<EnvApiGridRow> => ({
      headerName:
        slot === 0
          ? (connectionNames[0] ?? "Primary Connection")
          : (connectionNames[slot] ?? ""),
      children: [
        {
          colId: `current-${slot}`,
          valueGetter: (params: { data?: EnvApiGridRow }) =>
            params.data ? getEnvSlotCurrent(params.data, slot) : undefined,
          headerName: "Current Value",
          minWidth: 160,
          flex: 1,
          filter: true,
          sortable: true,
          resizable: true,
          cellStyle: (params: { data?: EnvApiGridRow }) =>
            getCompareCellStyle(
              (params.data ? getEnvSlotCurrent(params.data, slot) : null) ??
                null,
              getOtherValues(params.data, slot, "current"),
            ),
          cellRenderer: (params: { value?: EnvSettingValue }) => {
            return renderCompactValue(params.value ?? null);
          },
        },
        {
          colId: `new-${slot}`,
          valueGetter: (params: { data?: EnvApiGridRow }) =>
            params.data ? getEnvSlotNew(params.data, slot) : undefined,
          headerName: "New Value",
          minWidth: 160,
          flex: 1,
          filter: true,
          sortable: true,
          resizable: true,
          headerComponent: createSaveHeader(slot),
          cellStyle: (params: { data?: EnvApiGridRow }) =>
            getCompareCellStyle(
              (params.data ? getEnvSlotNew(params.data, slot) : null) ?? null,
              getOtherValues(params.data, slot, "new"),
            ),
          cellRenderer: (params: {
            data?: EnvApiGridRow;
            value?: EnvSettingValue;
          }) => {
            const row = params.data;
            const value = params.value;

            if (!row) {
              return null;
            }

            if (row.editable === false) {
              return renderCompactValue(value ?? null);
            }

            if (!row.edit) {
              return renderCompactValue(value ?? null);
            }

            return renderValueControl(
              row,
              value ?? null,
              (nextValue) => onNewValueChange(row.property, nextValue, slot),
              false,
            );
          },
        },
      ],
    });

    return [
      {
        colId: "Edit",
        headerName: "",
        width: 64,
        minWidth: 64,
        maxWidth: 64,
        sortable: false,
        resizable: false,
        cellRenderer: (params: CustomCellRendererProps<EnvApiGridRow>) => {
          const row = params.data;
          if (!row || row.editable === false) {
            return null;
          }

          return row.edit ? (
            <Button
              icon={<ArrowUndoRegular />}
              onClick={() => onToggleEdit(row.property, false)}
            />
          ) : (
            <Button
              icon={<EditRegular />}
              onClick={() => onToggleEdit(row.property, true)}
            />
          );
        },
      },
      {
        colId: "Info",
        headerName: "",
        width: 64,
        minWidth: 64,
        maxWidth: 64,
        sortable: false,
        resizable: false,
        cellRenderer: (params: CustomCellRendererProps<EnvApiGridRow>) => {
          return params.data?.shortDescription ? (
            <EnvironmentInfoPopup item={params.data} />
          ) : null;
        },
      },
      {
        field: "property",
        headerName: "Property",
        initialSort: "asc",
        flex: 1,
        minWidth: 220,
        filter: true,
        sortable: true,
        resizable: true,
        cellRenderer: (params: { value?: EnvSettingValue }) => {
          return renderCompactValue(params.value ?? null);
        },
      },
      slotHeaders(0),
      ...comparedSlots.map(slotHeaders),
    ] satisfies (ColDef<EnvApiGridRow> | ColGroupDef<EnvApiGridRow>)[];
  }, [
    connectionNamesKey,
    getCompareCellStyle,
    onNewValueChange,
    onToggleEdit,
    onSave,
    renderCompactValue,
    renderValueControl,
    pendingSlots,
    savingSlots,
  ]);

  if (isLoading) {
    return (
      <div className="info-box">
        <div className="loading">Loading environment settings from API...</div>
      </div>
    );
  }

  if (!isLoading && error) {
    return (
      <div className="info-box warning">
        <p>
          <strong>Unable to load environment settings</strong>
          <br />
          {error}
        </p>
      </div>
    );
  }

  if (isLoaded && !error) {
    return (
      <div className="env-grid-shell">
        <AgGridReact<EnvApiGridRow>
          ref={gridRef}
          theme={theme}
          rowData={visibleRows}
          columnDefs={resolvedColumnDefs}
          defaultColDef={{ wrapText: true, autoHeight: true }}
          domLayout="normal"
          enableCellTextSelection={true}
          ensureDomOrder={true}
          onGridReady={registerExport}
          onFilterChanged={registerExport}
          onSortChanged={registerExport}
          onModelUpdated={registerExport}
        />
      </div>
    );
  }

  return (
    <div className="info-box">
      <div>Select the tab to load environment settings.</div>
    </div>
  );
};
