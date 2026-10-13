import React from "react";
import { observer } from "mobx-react";
import { runInAction } from "mobx";
import {
  ArrowUndoRegular,
  EditRegular,
  Save20Filled,
  Warning24Regular,
} from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";
import {
  AgGridReact,
  CustomCellRendererProps,
  CustomInnerHeaderProps,
} from "ag-grid-react";
import { ColGroupDef, Theme } from "ag-grid-community";
import {
  orgProp,
  getSlotCurrent,
  getSlotNew,
  setSlotNew,
} from "../model/OrgSetting";
import { InputControl } from "./InputControl";
import { InfoPopup } from "./Info";
import { comparisonValuesDiffer } from "./ComparisonFilterButton";
import {
  getDisplayedGridRows,
  type ExcelSheet,
  type GridExportRegistration,
} from "../utils/excelExport";

function setItemEdit(item: orgProp, edit: boolean) {
  runInAction(() => {
    item.edit = edit;
    item.new = item.current;
    item.others?.forEach((_, slot) => {
      setSlotNew(item, slot, getSlotCurrent(item, slot));
    });
  });
}

// Slots 1..n that have a connection name (index = connection slot).
function getComparedSlots(connectionNames: Array<string | undefined>) {
  return connectionNames
    .map((name, slot) => (slot > 0 && name ? slot : -1))
    .filter((slot) => slot > 0);
}

function rowDiffers(row: orgProp, slots: number[]): boolean {
  return slots.some(
    (slot) =>
      comparisonValuesDiffer(row.current, getSlotCurrent(row, slot)) ||
      comparisonValuesDiffer(row.new, getSlotNew(row, slot)),
  );
}

interface OrgSettingsGridProps {
  rowData: orgProp[];
  connectionNames: Array<string | undefined>;
  isPowerPlatformApiUnavailable?: boolean;
  showOnlyDifferences: boolean;
  theme: Theme | "legacy";
  onSave: (slot: number) => void;
  setItemNewValue: (item: orgProp, newValue: string, slot?: number) => void;
  onExportRegistration?: (registration: GridExportRegistration) => void;
}

export function createOrgSettingsSheet(
  rows: orgProp[],
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
    name: "Organization Settings",
    columns: [
      { header: "Name", width: 36 },
      ...allSlots.flatMap((slot) => {
        const name = connectionNames[slot] ?? "Primary Connection";
        return [
          { header: `${name} - Current`, width: 28 },
          { header: `${name} - New`, width: 28 },
        ];
      }),
    ],
    rows: exportRows.map((row) => [
      row.name,
      ...allSlots.flatMap((slot) =>
        slot === 0
          ? [row.current, row.new ?? row.current]
          : [
              getSlotCurrent(row, slot) ?? "",
              getSlotNew(row, slot) ?? getSlotCurrent(row, slot) ?? "",
            ],
      ),
    ]),
  };
}

export const OrgSettingsGrid = (
  props: OrgSettingsGridProps,
): React.JSX.Element => {
  const {
    rowData,
    connectionNames,
    isPowerPlatformApiUnavailable,
    showOnlyDifferences,
    theme,
    onSave,
    setItemNewValue,
    onExportRegistration,
  } = props;
  const gridRef = React.useRef<AgGridReact<orgProp>>(null);
  const connectionNamesKey = JSON.stringify(connectionNames);
  const comparedSlots = getComparedSlots(connectionNames);
  const hasComparison = comparedSlots.length > 0;
  const visibleRows =
    hasComparison && showOnlyDifferences
      ? rowData.filter((row) => rowDiffers(row, comparedSlots))
      : rowData;
  const registerExport = React.useCallback(() => {
    const api = gridRef.current?.api;
    if (!api || !onExportRegistration) {
      return;
    }

    onExportRegistration({
      id: "org-settings",
      contextKey: connectionNamesKey,
      rowCount: getDisplayedGridRows(api).length,
      getSheet: () =>
        createOrgSettingsSheet(
          getDisplayedGridRows(api),
          (JSON.parse(connectionNamesKey) as Array<string | null>).map(
            (n) => n ?? undefined,
          ),
        ),
    });
  }, [connectionNamesKey, onExportRegistration]);

  React.useEffect(registerExport, [registerExport]);

  const getCompareCellStyle = React.useCallback(
    (leftValue: unknown, rightValues: unknown[]) => {
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          width: "100%",
        }}
      >
        <Tooltip
          content="The Power Platform API is not available on this connection."
          relationship="label"
        >
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

  const createSaveHeader = (slot: number) =>
    observer((params: CustomInnerHeaderProps<orgProp>) => {
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
          <div className="org-grid-header-label" title={params.displayName}>
            {params.displayName}
          </div>
          {rowData.some(
            (op) => op.edit && getSlotNew(op, slot) !== getSlotCurrent(op, slot),
          ) && <Button icon={<Save20Filled />} onClick={() => onSave(slot)} />}
        </div>
      );
    });

  const cellIcon = observer((params: CustomCellRendererProps<orgProp>) => (
    <div
      className="imgSpanLogo"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {params.data?.edit ? (
        <Button
          icon={<ArrowUndoRegular />}
          onClick={() =>
            params.data && setItemEdit(params.data, !params.data.edit)
          }
        />
      ) : (
        <Button
          icon={<EditRegular />}
          onClick={() =>
            params.data && setItemEdit(params.data, !params.data.edit)
          }
        />
      )}
    </div>
  ));

  const cellInfo = observer((params: CustomCellRendererProps<orgProp>) => (
    <div className="imgCellInfo">
      {params.data && <InfoPopup item={params.data} />}
    </div>
  ));

  const columnDefs = React.useMemo(() => {
    const getOtherValues = (
      row: orgProp | undefined,
      slot: number,
      kind: "current" | "new",
    ): unknown[] => {
      if (!row) {
        return [];
      }
      const get = kind === "current" ? getSlotCurrent : getSlotNew;
      // Slot 0 is compared against every other slot, others against slot 0.
      return slot === 0
        ? comparedSlots.map((s) => get(row, s))
        : [get(row, 0) ?? undefined];
    };

    const slotHeaders = (slot: number): ColGroupDef<orgProp> => ({
      headerName:
        slot === 0
          ? (connectionNames[0] ?? "Primary Connection")
          : (connectionNames[slot] ?? ""),
      children: [
        {
          colId: `current-${slot}`,
          valueGetter: (params: { data?: orgProp }) =>
            params.data ? getSlotCurrent(params.data, slot) : undefined,
          headerName: "Current Value",
          flex: 1,
          minWidth: 160,
          cellStyle: (params: { data?: orgProp }) =>
            getCompareCellStyle(
              params.data ? (getSlotCurrent(params.data, slot) ?? null) : null,
              getOtherValues(params.data, slot, "current"),
            ),
          cellRenderer: (params: { value?: string }) =>
            renderCompactValue(params.value),
        },
        {
          colId: `new-${slot}`,
          valueGetter: (params: { data?: orgProp }) =>
            params.data ? getSlotNew(params.data, slot) : undefined,
          flex: 1,
          minWidth: 160,
          headerName: "New Value",
          headerComponent: createSaveHeader(slot),
          cellStyle: (params: { data?: orgProp }) =>
            getCompareCellStyle(
              params.data ? (getSlotNew(params.data, slot) ?? null) : null,
              getOtherValues(params.data, slot, "new"),
            ),
          cellRenderer: (params: { data: orgProp }) =>
            params.data ? (
              <InputControl
                item={params.data}
                setItemNewValue={setItemNewValue}
                slot={slot}
              />
            ) : null,
        },
      ],
    });

    return [
      {
        headerName: "",
        headerGroupComponent: topLeftHeader,
        children: [
          {
            colId: "Edit",
            resizable: false,
            width: 64,
            minWidth: 64,
            maxWidth: 64,
            sortable: false,
            headerName: "",
            cellRenderer: cellIcon,
          },
          {
            colId: "Info",
            resizable: false,
            width: 64,
            minWidth: 64,
            maxWidth: 64,
            sortable: false,
            headerName: "",
            cellRenderer: cellInfo,
          },
          {
            field: "name",
            headerName: "Name",
            initialSort: "asc",
            filter: true,
            flex: 2,
            minWidth: 220,
            cellRenderer: (params: { value?: string }) =>
              renderCompactValue(params.value),
          },
        ],
      },
      slotHeaders(0),
      ...comparedSlots.map(slotHeaders),
    ] as ColGroupDef<orgProp>[];
  }, [
    connectionNamesKey,
    setItemNewValue,
    onSave,
    rowData,
    getCompareCellStyle,
    topLeftHeader,
    renderCompactValue,
  ]);

  return (
    <div className="org-grid-shell">
      <AgGridReact<orgProp>
        ref={gridRef}
        theme={theme}
        rowData={visibleRows}
        columnDefs={columnDefs}
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
};
