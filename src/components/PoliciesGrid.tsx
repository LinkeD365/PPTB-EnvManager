import React from "react";
import { AgGridReact } from "ag-grid-react";
import { Button } from "@fluentui/react-components";
import { ArrowLeft16Regular } from "@fluentui/react-icons";
import {
  ColDef,
  ModuleRegistry,
  RowAutoHeightModule,
  CellStyleModule,
  RenderApiModule,
  Theme,
  ValidationModule,
  RowSelectionModule,
} from "ag-grid-community";
import { EnvironmentGroupRow } from "./EnvironmentGroupsList";
import { environmentManagement, EnvironmentGroupPolicyRuleSetRow } from "../utils/environmentManagement";

ModuleRegistry.registerModules([RowAutoHeightModule, ValidationModule, CellStyleModule, RenderApiModule, RowSelectionModule]);

interface PoliciesGridProps {
  groups: EnvironmentGroupRow[];
  theme: Theme | "legacy";
  onBack: () => void;
}

interface PolicyCompareRow {
  rowKey: string;
  ruleSetId: string;
  rowType: "ruleSet" | "connector";
  connectorName?: string;
  value1: string;
  value2?: string;
}

function getPolicyRowValue(row: EnvironmentGroupPolicyRuleSetRow): string {
  if (row.rowType === "connector") {
    return row.connectorName ?? row.allowedConnectorNames[0] ?? "";
  }

  return row.allowedConnectorNames.length > 0 ? row.allowedConnectorNames.join(", ") : "";
}

function getPolicyCompareKey(row: EnvironmentGroupPolicyRuleSetRow): string {
  if (row.rowType === "connector") {
    return `${row.ruleSetId}::${row.connectorName ?? row.allowedConnectorNames[0] ?? ""}`;
  }

  return row.ruleSetId;
}

function buildPolicyCompareRows(
  groupedRules: Array<{ group: EnvironmentGroupRow; rules: EnvironmentGroupPolicyRuleSetRow[] }>
): PolicyCompareRow[] {
  const byRule = new Map<string, PolicyCompareRow>();

  groupedRules.forEach(({ rules }, index) => {
    rules.forEach((rule) => {
      const key = getPolicyCompareKey(rule);
      const existing = byRule.get(key);
      const value = getPolicyRowValue(rule);

      if (!existing) {
        byRule.set(key, {
          rowKey: key,
          ruleSetId: rule.ruleSetId,
          rowType: rule.rowType,
          connectorName: rule.connectorName,
          value1: index === 0 ? value : "",
          value2: index === 1 ? value : "",
        });
        return;
      }

      if (index === 0) {
        existing.value1 = value;
      }

      if (index === 1) {
        existing.value2 = value;
      }
    });
  });

  return Array.from(byRule.values()).sort((left, right) => {
    const ruleCompare = left.ruleSetId.localeCompare(right.ruleSetId);
    if (ruleCompare !== 0) {
      return ruleCompare;
    }

    if (left.rowType === right.rowType) {
      return 0;
    }

    return left.rowType === "ruleSet" ? -1 : 1;
  });
}

export const PoliciesGrid = React.memo((props: PoliciesGridProps): React.JSX.Element => {
  const { groups, theme, onBack } = props;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<PolicyCompareRow[]>([]);

  const activeGroups = React.useMemo(() => groups.slice(0, 2), [groups]);
  const groupNames = React.useMemo(() => activeGroups.map((group) => group.displayName), [activeGroups]);
  const isCompareMode = activeGroups.length === 2;

  React.useEffect(() => {
    let cancelled = false;

    const loadPolicies = async () => {
      console.log("[PoliciesGrid] loading policies", {
        environmentGroupIds: activeGroups.map((group) => group.environmentGroupId),
      });
      setLoading(true);
      setError(null);
      setRows([]);

      try {
        const loadedByGroup = await Promise.all(
          activeGroups.map(async (group) => {
            const loadedRules = await environmentManagement.getEnvironmentGroupPolicyRules(group.environmentGroupId, {
              connectionTarget: "primary",
            });
            return {
              group,
              rules: loadedRules,
            };
          })
        );

        const mergedRows = buildPolicyCompareRows(loadedByGroup);

        console.log("[PoliciesGrid] loaded policies", {
          environmentGroupIds: activeGroups.map((group) => group.environmentGroupId),
          count: mergedRows.length,
          mergedRows,
        });

        if (!cancelled) {
          setRows(mergedRows);
        }
      } catch (err) {
        console.log("[PoliciesGrid] failed to load policies", {
          environmentGroupIds: activeGroups.map((group) => group.environmentGroupId),
          error: err,
        });
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPolicies();

    return () => {
      cancelled = true;
    };
  }, [activeGroups]);

  const columnDefs = React.useMemo(
    () =>
      (
        [
        {
          field: "ruleSetId",
          headerName: "Rule Set",
          flex: 2,
          minWidth: 220,
          filter: true,
          sortable: true,
          wrapText: true,
          autoHeight: true,
          cellRenderer: (params: { value?: string; data?: PolicyCompareRow }) => {
            const row = params.data;
            if (!row) {
              return params.value ?? "";
            }

            const label = params.value ?? "";
            return row.rowType === "connector" ? `↳ ${label}` : label;
          },
        },
        {
          field: "value1",
          headerName: isCompareMode ? groupNames[0] : "Value",
          flex: 1.4,
          filter: true,
          sortable: false,
          wrapText: true,
          autoHeight: true,
          cellRenderer: (params: { value?: string }) => params.value ?? "",
        },
        ...(isCompareMode
          ? [
              {
                field: "value2",
                headerName: groupNames[1],
                flex: 1.4,
                filter: true,
                sortable: false,
                wrapText: true,
                autoHeight: true,
                cellRenderer: (params: { value?: string }) => params.value ?? "",
              } satisfies ColDef<PolicyCompareRow>,
            ]
          : []),
      ] satisfies ColDef<PolicyCompareRow>[]),
    [groupNames, isCompareMode]
  );

  if (loading) {
    return (
      <div className="info-box">
        <div className="loading">
          Loading policy grid for {groupNames.join(" and ")}...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button appearance="subtle" icon={<ArrowLeft16Regular />} onClick={onBack}>
            Back to groups
          </Button>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {isCompareMode ? "Policy comparison" : groupNames[0]}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {activeGroups.map((group) => group.environmentGroupId).join(" | ")}
            </div>
          </div>
        </div>
        <div className="info-box warning">
          <p>
            <strong>Unable to load policies</strong>
            <br />
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button appearance="subtle" icon={<ArrowLeft16Regular />} onClick={onBack}>
          Back to groups
        </Button>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isCompareMode ? "Policy comparison" : groupNames[0]}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeGroups.map((group) => `${group.displayName} (${group.environmentGroupId})`).join(" | ")}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="info-box">
          <div>No rule-based policies are assigned to the selected environment group(s).</div>
        </div>
      ) : (
        <div className="env-grid-shell" style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact<PolicyCompareRow>
            theme={theme}
            rowData={rows}
            columnDefs={columnDefs}
            domLayout="normal"
            enableCellTextSelection={true}
            ensureDomOrder={true}
            getRowId={(params) => params.data.rowKey}
            getRowStyle={(params) => {
              const row = params.data;
              if (!row) {
                return undefined;
              }

              return row.rowType === "connector"
                ? { backgroundColor: "var(--colorNeutralBackground2)" }
                : undefined;
            }}
          />
        </div>
      )}
    </div>
  );
});
