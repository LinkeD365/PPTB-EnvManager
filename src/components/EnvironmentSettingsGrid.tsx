import React from "react";
import { ArrowUndoRegular, EditRegular, Save20Filled } from "@fluentui/react-icons";
import { Button, Badge, Input, Switch } from "@fluentui/react-components";
import { AgGridReact } from "ag-grid-react";
import { CustomCellRendererProps, CustomInnerHeaderProps } from "ag-grid-react";
import { ColDef, ColGroupDef, Theme } from "ag-grid-community";
import { EnvironmentInfoPopup } from "./EnvironmentInfo";

export type EnvSettingValue = string | number | boolean | null;

export interface EnvApiGridRow {
  property: string;
  current: EnvSettingValue;
  new: EnvSettingValue;
  secondaryCurrent?: EnvSettingValue;
  secondaryNew?: EnvSettingValue;
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
  connectionName?: string;
  secondaryConnectionName?: string;
  theme: Theme | "legacy";
  isSaving: boolean;
  isSecondarySaving: boolean;
  hasPendingChanges: boolean;
  hasSecondaryPendingChanges: boolean;
  onToggleEdit: (property: string, edit: boolean) => void;
  onNewValueChange: (property: string, nextValue: EnvSettingValue, secondary?: boolean) => void;
  onSave: () => void;
  onSaveSecondary: () => void;
}

export const EnvironmentSettingsGrid = (props: EnvironmentSettingsGridProps): React.JSX.Element => {
  const {
    isLoading,
    error,
    isLoaded,
    rows,
    connectionName,
    secondaryConnectionName,
    theme,
    isSaving,
    isSecondarySaving,
    hasPendingChanges,
    hasSecondaryPendingChanges,
    onToggleEdit,
    onNewValueChange,
    onSave,
    onSaveSecondary,
  } = props;

  const formatCurrentValueText = React.useCallback((value: EnvSettingValue): string => {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    return String(value);
  }, []);

  const renderCompactValue = React.useCallback(
    (value: EnvSettingValue) => {
      const text = formatCurrentValueText(value);
      return (
        <span className="env-grid-value" title={text}>
          {text}
        </span>
      );
    },
    [formatCurrentValueText]
  );

  const saveHeaderButton = React.useCallback(
    (params: CustomInnerHeaderProps<EnvApiGridRow>) => (
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
        {hasPendingChanges && (
          <Button icon={<Save20Filled />} disabled={isSaving} onClick={onSave} />
        )}
      </div>
    ),
    [hasPendingChanges, isSaving, onSave]
  );

  const saveHeaderSecondaryButton = React.useCallback(
    (params: CustomInnerHeaderProps<EnvApiGridRow>) => (
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
        {hasSecondaryPendingChanges && (
          <Button icon={<Save20Filled />} disabled={isSecondarySaving} onClick={onSaveSecondary} />
        )}
      </div>
    ),
    [hasSecondaryPendingChanges, isSecondarySaving, onSaveSecondary]
  );

  const renderValueControl = React.useCallback(
    (
      row: EnvApiGridRow,
      value: EnvSettingValue,
      onChange: (nextValue: EnvSettingValue) => void,
      inputReadOnly = false
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
    []
  );

  const resolvedColumnDefs = React.useMemo(() => {
    const secondaryHeaders: ColGroupDef<EnvApiGridRow>[] = secondaryConnectionName
      ? [
          {
            headerName: secondaryConnectionName,
            children: [
              {
                field: "secondaryCurrent",
                headerName: "Current Value",
                minWidth: 160,
                flex: 1,
                filter: true,
                sortable: true,
                resizable: true,
                cellRenderer: (params: { value?: EnvSettingValue }) => {
                  return renderCompactValue(params.value ?? null);
                },
              },
              {
                field: "secondaryNew",
                headerName: "New Value",
                minWidth: 160,
                flex: 1,
                filter: true,
                sortable: true,
                resizable: true,
                headerComponent: saveHeaderSecondaryButton,
                cellRenderer: (params: { data?: EnvApiGridRow; value?: EnvSettingValue }) => {
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
                    (nextValue) => onNewValueChange(row.property, nextValue, true),
                    false
                  );
                },
              },
            ],
          },
        ]
      : [];

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
            <Button icon={<ArrowUndoRegular />} onClick={() => onToggleEdit(row.property, false)} />
          ) : (
            <Button icon={<EditRegular />} onClick={() => onToggleEdit(row.property, true)} />
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
          return params.data?.shortDescription ? <EnvironmentInfoPopup item={params.data} /> : null;
        },
      },
      {
        field: "property",
        headerName: "Property",
        flex: 1,
        minWidth: 220,
        filter: true,
        sortable: true,
        resizable: true,
        cellRenderer: (params: { value?: EnvSettingValue }) => {
          return renderCompactValue(params.value ?? null);
        },
      },
      {
        headerName: connectionName ?? "Primary Connection",
        children: [
          {
            field: "current",
            headerName: "Current Value",
            minWidth: 160,
            flex: 1,
            filter: true,
            sortable: true,
            resizable: true,
            cellRenderer: (params: { value?: EnvSettingValue }) => {
              return renderCompactValue(params.value ?? null);
            },
          },
          {
            field: "new",
            headerName: "New Value",
            minWidth: 160,
            flex: 1,
            filter: true,
            sortable: true,
            resizable: true,
            headerComponent: saveHeaderButton,
            cellRenderer: (params: { data?: EnvApiGridRow; value?: EnvSettingValue }) => {
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
                (nextValue) => onNewValueChange(row.property, nextValue, false),
                false
              );
            },
          },
        ],
      },
      ...secondaryHeaders,
    ] satisfies (ColDef<EnvApiGridRow> | ColGroupDef<EnvApiGridRow>)[];
  }, [connectionName, onNewValueChange, onToggleEdit, renderCompactValue, renderValueControl, saveHeaderButton, saveHeaderSecondaryButton, secondaryConnectionName]);

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
          theme={theme}
          rowData={rows}
          columnDefs={resolvedColumnDefs}
          domLayout="normal"
          enableCellTextSelection={true}
          ensureDomOrder={true}
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
