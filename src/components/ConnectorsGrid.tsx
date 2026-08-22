import React from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ColGroupDef, Theme } from "ag-grid-community";
import { EnvGroupPolicyConnectorRow } from "../utils/envMgmt";
import { EnvironmentGroupRow } from "./EnvironmentGroupsList";

interface ConnectorsGridProps {
  groups: EnvironmentGroupRow[];
  connectors: EnvGroupPolicyConnectorRow[];
  secondaryConnectors: EnvGroupPolicyConnectorRow[];
  showOnlyDifferences: boolean;
  theme: Theme | "legacy";
}

interface PolicyConnectorGridRow {
  rowKey: string;
  connectorName: string;
  primaryConnector?: EnvGroupPolicyConnectorRow;
  secondaryConnector?: EnvGroupPolicyConnectorRow;
}

export function ConnectorsGrid({
  groups,
  connectors,
  secondaryConnectors,
  showOnlyDifferences,
  theme,
}: ConnectorsGridProps): React.JSX.Element {
  const rows = React.useMemo<PolicyConnectorGridRow[]>(() => {
    const rowsByPath = new Map<string, PolicyConnectorGridRow>();

    for (const connector of connectors) {
      const rowKey = connector.connectorPath.toLowerCase();
      rowsByPath.set(rowKey, {
        rowKey,
        connectorName: connector.connectorName,
        primaryConnector: connector,
      });
    }

    for (const connector of secondaryConnectors) {
      const rowKey = connector.connectorPath.toLowerCase();
      const existing = rowsByPath.get(rowKey);
      rowsByPath.set(rowKey, {
        rowKey,
        connectorName: existing?.connectorName ?? connector.connectorName,
        primaryConnector: existing?.primaryConnector,
        secondaryConnector: connector,
      });
    }

    return Array.from(rowsByPath.values());
  }, [connectors, secondaryConnectors]);
  const visibleRows =
    groups[1] && showOnlyDifferences
      ? rows.filter((row) => !row.primaryConnector || !row.secondaryConnector)
      : rows;

  const getCompareCellStyle = React.useCallback(
    (leftValue: string | undefined, rightValue: string | undefined) => {
      if (!groups[1] || (leftValue ?? "") === (rightValue ?? "")) {
        return undefined;
      }

      return {
        backgroundColor: "rgba(255, 193, 7, 0.18)",
        borderLeft: "3px solid #ffbf00",
      };
    },
    [groups],
  );

  const columnDefs = React.useMemo<
    (ColDef<PolicyConnectorGridRow> | ColGroupDef<PolicyConnectorGridRow>)[]
  >(() => {
    const groupColumn = (
      secondary: boolean,
    ): ColGroupDef<PolicyConnectorGridRow> => ({
      headerName:
        groups[secondary ? 1 : 0]?.displayName ??
        (secondary ? "Secondary Group" : "Primary Group"),
      children: [
        {
          colId: secondary ? "SecondaryPath" : "PrimaryPath",
          headerName: "Connector Path",
          flex: 2,
          minWidth: 280,
          valueGetter: (params) =>
            (secondary
              ? params.data?.secondaryConnector
              : params.data?.primaryConnector
            )?.connectorPath ?? "",
          cellStyle: (params) =>
            getCompareCellStyle(
              secondary
                ? params.data?.secondaryConnector?.connectorPath
                : params.data?.primaryConnector?.connectorPath,
              secondary
                ? params.data?.primaryConnector?.connectorPath
                : params.data?.secondaryConnector?.connectorPath,
            ),
        },
      ],
    });

    return [
      {
        field: "connectorName",
        headerName: "Connector",
        initialSort: "asc",
        flex: 1,
        minWidth: 180,
      },
      groupColumn(false),
      ...(groups[1] ? [groupColumn(true)] : []),
    ];
  }, [getCompareCellStyle, groups]);

  return (
    <AgGridReact<PolicyConnectorGridRow>
      theme={theme}
      rowData={visibleRows}
      getRowId={(params) => params.data.rowKey}
      columnDefs={columnDefs}
      defaultColDef={{
        editable: false,
        sortable: true,
        resizable: true,
        filter: true,
      }}
      domLayout="normal"
      enableCellTextSelection={true}
      ensureDomOrder={true}
    />
  );
}
