import React from "react";
import { observer } from "mobx-react";
import { runInAction } from "mobx";
import { ArrowUndoRegular, EditRegular, Save20Filled, Warning24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";
import { AgGridReact, CustomCellRendererProps, CustomInnerHeaderProps } from "ag-grid-react";
import { ColGroupDef, Theme } from "ag-grid-community";
import { orgProp } from "../model/OrgSetting";
import { InputControl } from "./InputControl";
import { InfoPopup } from "./Info";

function setItemEdit(item: orgProp, edit: boolean) {
  runInAction(() => {
    item.edit = edit;
    item.new = item.current;
  });
}

interface OrgSettingsGridProps {
  rowData: orgProp[];
  connectionName?: string;
  secondaryConnectionName?: string;
  isPowerPlatformApiUnavailable?: boolean;
  theme: Theme | "legacy";
  onSavePrimary: () => void;
  onSaveSecondary: () => void;
  setItemNewValue: (item: orgProp, newValue: string, secondary?: boolean) => void;
}

export const OrgSettingsGrid = (props: OrgSettingsGridProps): React.JSX.Element => {
  const {
    rowData,
    connectionName,
    secondaryConnectionName,
    isPowerPlatformApiUnavailable,
    theme,
    onSavePrimary,
    onSaveSecondary,
    setItemNewValue,
  } = props;

  const renderCompactValue = React.useCallback((value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return (
      <span className="org-grid-value" title={text}>
        {text}
      </span>
    );
  }, []);

  const topLeftHeader = React.useCallback(() => {
    if (!isPowerPlatformApiUnavailable) {
      return null;
    }

    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", width: "100%" }}>
        <Tooltip content="The Power Platform API is not available on this connection." relationship="label">
          <Button
            appearance="subtle"
            aria-label="The Power Platform API is not available on this connection."
            icon={<Warning24Regular />}
            disabled
          />
        </Tooltip>
      </div>
    );
  }, [isPowerPlatformApiUnavailable]);

  const saveHeaderButton = observer((params: CustomInnerHeaderProps<orgProp>) => {
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
        <div className="org-grid-header-label" title={params.displayName}>{params.displayName}</div>
        {rowData.some((op) => op.edit && op.new !== op.current) && (
          <Button icon={<Save20Filled />} onClick={onSavePrimary} />
        )}
      </div>
    );
  });

  const saveHeaderSecondaryButton = observer((params: CustomInnerHeaderProps<orgProp>) => {
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
        <div className="org-grid-header-label" title={params.displayName}>{params.displayName}</div>
        {rowData.some((op) => op.edit && op.secondaryNew !== op.secondaryCurrent) && (
          <Button icon={<Save20Filled />} onClick={onSaveSecondary} />
        )}
      </div>
    );
  });

  const cellIcon = observer((params: CustomCellRendererProps<orgProp>) => (
    <div className="imgSpanLogo" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
      {params.data?.edit ? (
        <Button
          icon={<ArrowUndoRegular />}
          onClick={() => params.data && setItemEdit(params.data, !params.data.edit)}
        />
      ) : (
        <Button icon={<EditRegular />} onClick={() => params.data && setItemEdit(params.data, !params.data.edit)} />
      )}
    </div>
  ));

  const cellInfo = observer((params: CustomCellRendererProps<orgProp>) => (
    <div className="imgCellInfo">{params.data && <InfoPopup item={params.data} />}</div>
  ));

  const columnDefs = React.useMemo(() => {
    const secondaryHeaders: ColGroupDef<orgProp>[] = secondaryConnectionName
      ? [
          {
            headerName: secondaryConnectionName,
            children: [
              {
                field: "secondaryCurrent",
                headerName: "Current Value",
                flex: 1,
                minWidth: 160,
                cellRenderer: (params: { value?: string }) => renderCompactValue(params.value),
              },
              {
                field: "secondaryNew",
                flex: 1,
                minWidth: 160,
                headerName: "New Value",
                headerComponent: saveHeaderSecondaryButton,
                cellRenderer: (params: { data: orgProp }) =>
                  params.data ? (
                    <InputControl item={params.data} setItemNewValue={setItemNewValue} secondary={true} />
                  ) : null,
              },
            ],
          },
        ]
      : [];

    return [
      {
        headerName: "",
        headerGroupComponent: topLeftHeader,
        children: [
          { colId: "Edit", resizable: false, width: 64, minWidth: 64, maxWidth: 64, sortable: false, headerName: "", cellRenderer: cellIcon },
          { colId: "Info", resizable: false, width: 64, minWidth: 64, maxWidth: 64, sortable: false, headerName: "", cellRenderer: cellInfo },
          {
            field: "name",
            headerName: "Name",
            filter: true,
            flex: 2,
            minWidth: 220,
            cellRenderer: (params: { value?: string }) => renderCompactValue(params.value),
          },
        ],
      },
      {
        headerName: connectionName ?? "Primary Connection",
        children: [
          {
            field: "current",
            headerName: "Current Value",
            flex: 1,
            minWidth: 160,
            cellRenderer: (params: { value?: string }) => renderCompactValue(params.value),
          },
          {
            field: "new",
            flex: 1,
            minWidth: 160,
            headerName: "New Value",
            headerComponent: saveHeaderButton,
            cellRenderer: (params: { data: orgProp }) =>
              params.data ? (
                <InputControl item={params.data} setItemNewValue={setItemNewValue} secondary={false} />
              ) : null,
          },
        ],
      },
      ...secondaryHeaders,
    ] as ColGroupDef<orgProp>[];
  }, [secondaryConnectionName, connectionName, saveHeaderSecondaryButton, setItemNewValue, cellIcon, cellInfo, saveHeaderButton, topLeftHeader, renderCompactValue]);

  return (
    <div className="org-grid-shell">
      <AgGridReact<orgProp>
        theme={theme}
        rowData={rowData}
        columnDefs={columnDefs}
        domLayout="normal"
        enableCellTextSelection={true}
        ensureDomOrder={true}
      />
    </div>
  );
};
