import React from "react";
import { AgGridReact, CustomCellRendererProps, CustomInnerHeaderProps } from "ag-grid-react";
import { Button, Input, Switch } from "@fluentui/react-components";
import { ArrowLeft16Regular, ArrowUndoRegular, EditRegular, Save20Filled } from "@fluentui/react-icons";
import {
  ColDef,
  ColGroupDef,
  ModuleRegistry,
  RowAutoHeightModule,
  CellStyleModule,
  RenderApiModule,
  RowStyleModule,
  Theme,
  ValidationModule,
  RowSelectionModule,
} from "ag-grid-community";
import { EnvironmentGroupRow } from "./EnvironmentGroupsList";
import { RuleSetInfoPopup } from "./Info";
import { environmentManagement, EnvironmentGroupPolicyRuleSetRow, PolicyRowUpdateContext } from "../utils/environmentManagement";

ModuleRegistry.registerModules([RowAutoHeightModule, ValidationModule, CellStyleModule, RenderApiModule, RowStyleModule, RowSelectionModule]);

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
  newValue1: string;
  newValue2: string;
  edit: boolean;
  edit1: boolean;
  edit2: boolean;
  editable1: boolean;
  editable2: boolean;
  valueType1: "boolean" | "number" | "text";
  valueType2: "boolean" | "number" | "text";
  displayName?: string;
  description?: string;
  isPreview?: boolean;
  learnMoreText?: string;
  learnMoreLink?: string;
  updateContext1?: PolicyRowUpdateContext;
  updateContext2?: PolicyRowUpdateContext;
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
      const editable = Boolean(rule.editable && rule.updateContext);
      const valueType = rule.valueType ?? "text";

      if (!existing) {
        byRule.set(key, {
          rowKey: key,
          ruleSetId: rule.ruleSetId,
          rowType: rule.rowType,
          connectorName: rule.connectorName,
          value1: index === 0 ? value : "",
          value2: index === 1 ? value : "",
          newValue1: index === 0 ? value : "",
          newValue2: index === 1 ? value : "",
          edit: false,
          edit1: false,
          edit2: false,
          editable1: index === 0 ? editable : false,
          editable2: index === 1 ? editable : false,
          valueType1: index === 0 ? valueType : "text",
          valueType2: index === 1 ? valueType : "text",
          displayName: rule.displayName,
          description: rule.description,
          isPreview: rule.isPreview,
          learnMoreText: rule.learnMoreText,
          learnMoreLink: rule.learnMoreLink,
          updateContext1: index === 0 ? rule.updateContext : undefined,
          updateContext2: index === 1 ? rule.updateContext : undefined,
        });
        return;
      }

      if (index === 0) {
        existing.value1 = value;
        existing.newValue1 = value;
        existing.editable1 = editable;
        existing.valueType1 = valueType;
        existing.updateContext1 = rule.updateContext;
      }

      if (index === 1) {
        existing.value2 = value;
        existing.newValue2 = value;
        existing.editable2 = editable;
        existing.valueType2 = valueType;
        existing.updateContext2 = rule.updateContext;
      }

      existing.displayName = existing.displayName ?? rule.displayName;
      existing.description = existing.description ?? rule.description;
      existing.isPreview = existing.isPreview ?? rule.isPreview;
      existing.learnMoreText = existing.learnMoreText ?? rule.learnMoreText;
      existing.learnMoreLink = existing.learnMoreLink ?? rule.learnMoreLink;
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

function coerceApiValue(newValue: string, valueType?: "boolean" | "number" | "text"): string | number | boolean {
  if (valueType === "boolean") {
    const normalized = newValue.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
    return Boolean(newValue);
  }

  if (valueType === "number") {
    if (newValue.trim() === "") {
      return "";
    }

    const parsed = Number(newValue);
    return Number.isFinite(parsed) ? parsed : newValue;
  }

  return newValue;
}

function applyRuleSetValueUpdate(
  ruleSet: Record<string, unknown>,
  parameterType: string,
  propertyName: string,
  newValue: string,
  valueType?: "boolean" | "number" | "text"
): Record<string, unknown> {
  const ruleSetClone = JSON.parse(JSON.stringify(ruleSet)) as Record<string, unknown>;
  const parameters = Array.isArray(ruleSetClone.parameters) ? (ruleSetClone.parameters as Record<string, unknown>[]) : [];
  ruleSetClone.parameters = parameters;

  let parameter = parameters.find(
    (candidate) =>
      candidate && typeof candidate === "object" && String((candidate as Record<string, unknown>).type ?? "").toLowerCase() === parameterType.toLowerCase()
  ) as Record<string, unknown> | undefined;

  if (!parameter) {
    // Rule set has no existing entry for this type yet; create one, borrowing "resourceType" from a
    // sibling parameter (if any) since the API requires it but doesn't expose it anywhere else.
    const sibling = parameters.find(
      (candidate) => candidate && typeof candidate === "object" && (candidate as Record<string, unknown>).resourceType !== undefined
    ) as Record<string, unknown> | undefined;
    parameter = { type: parameterType, resourceType: sibling?.resourceType, value: [] };
    parameters.push(parameter);
  }

  const values = Array.isArray(parameter.value) ? (parameter.value as Record<string, unknown>[]) : [];
  parameter.value = values;

  const target = values.find(
    (candidate) => candidate && typeof candidate === "object" && String((candidate as Record<string, unknown>).id ?? "").toLowerCase() === propertyName.toLowerCase()
  ) as Record<string, unknown> | undefined;

  const coercedValue = coerceApiValue(newValue, valueType);

  if (target) {
    target.value = coercedValue;
  } else {
    values.push({ id: propertyName, value: coercedValue });
  }

  return ruleSetClone;
}

function applyPolicyInputUpdate(
  policy: Record<string, unknown>,
  ruleSetIndex: number,
  inputKey: string,
  newValue: string,
  valueType?: "boolean" | "number" | "text"
): Record<string, unknown> {
  const policyClone = JSON.parse(JSON.stringify(policy)) as Record<string, unknown>;
  const ruleSets = policyClone.ruleSets;

  if (Array.isArray(ruleSets)) {
    const ruleSet = ruleSets[ruleSetIndex] as Record<string, unknown> | undefined;
    const inputs = ruleSet?.inputs;
    if (ruleSet && inputs && typeof inputs === "object") {
      (inputs as Record<string, unknown>)[inputKey] = coerceApiValue(newValue, valueType);
    }
  }

  return policyClone;
}


export const PoliciesGrid = React.memo((props: PoliciesGridProps): React.JSX.Element => {
  const { groups, theme, onBack } = props;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<PolicyCompareRow[]>([]);
  const [savingColumn, setSavingColumn] = React.useState<{ 0: boolean; 1: boolean }>({ 0: false, 1: false });

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
      setSaveError(null);
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

  const setRowEdit = React.useCallback((rowKey: string, edit: boolean) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowKey !== rowKey) {
          return row;
        }

        const nextRow = {
          ...row,
          edit1: row.editable1 ? edit : false,
          edit2: row.editable2 ? edit : false,
          edit,
          newValue1: row.editable1 && edit ? row.value1 : row.newValue1,
          newValue2: row.editable2 && edit ? (row.value2 ?? "") : row.newValue2,
        };

        return nextRow;
      })
    );
  }, []);

  const setRowNewValue = React.useCallback((rowKey: string, columnIndex: 0 | 1, newValue: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowKey !== rowKey) {
          return row;
        }

        return columnIndex === 0 ? { ...row, newValue1: newValue } : { ...row, newValue2: newValue };
      })
    );
  }, []);

  const handleSave = React.useCallback(
    async (columnIndex: 0 | 1) => {
      const editedRows = rows.filter((row) => {
        const isEditingColumn = columnIndex === 0 ? row.edit1 : row.edit2;
        if (!isEditingColumn) {
          return false;
        }

        const context = columnIndex === 0 ? row.updateContext1 : row.updateContext2;
        if (!context) {
          return false;
        }

        const currentValue = columnIndex === 0 ? row.value1 : row.value2 ?? "";
        const newValue = columnIndex === 0 ? row.newValue1 : row.newValue2;
        return newValue !== currentValue;
      });

      if (editedRows.length === 0) {
        console.log("[PoliciesGrid] save skipped: no changed editable rows", { columnIndex });
        window.toolboxAPI.utils.showNotification({
          title: "No policy changes to save",
          body: "No environment group policy values have been modified.",
          type: "info",
          duration: 3000,
        });
        return;
      }

      const saveStartedAt = Date.now();
      console.log("[PoliciesGrid] starting policy save", {
        columnIndex,
        groupNames,
        editedRows: editedRows.map((row) => ({
          rowKey: row.rowKey,
          ruleSetId: row.ruleSetId,
          currentValue: columnIndex === 0 ? row.value1 : row.value2 ?? "",
          newValue: columnIndex === 0 ? row.newValue1 : row.newValue2,
          updateKind: (columnIndex === 0 ? row.updateContext1 : row.updateContext2)?.kind,
        })),
      });

      setSavingColumn((prev) => ({ ...prev, [columnIndex]: true }));
      setSaveError(null);

      try {
        const ruleSetEditsByRuleSetId = new Map<
          string,
          { context: Extract<PolicyRowUpdateContext, { kind: "ruleSet" }>; edits: Array<{ parameterType: string; propertyName: string; value: string; valueType: "boolean" | "number" | "text" }> }
        >();
        const policyEditsByPolicyId = new Map<
          string,
          { context: Extract<PolicyRowUpdateContext, { kind: "ruleBasedPolicy" }>; edits: Array<{ ruleSetIndex: number; inputKey: string; value: string; valueType: "boolean" | "number" | "text" }> }
        >();

        editedRows.forEach((row) => {
          const context = (columnIndex === 0 ? row.updateContext1 : row.updateContext2)!;
          const newValue = columnIndex === 0 ? row.newValue1 : row.newValue2;
          const valueType = columnIndex === 0 ? row.valueType1 : row.valueType2;

          if (context.kind === "ruleSet") {
            const existing = ruleSetEditsByRuleSetId.get(context.ruleSetId);
            if (existing) {
              existing.edits.push({ parameterType: context.parameterType, propertyName: context.propertyName, value: newValue, valueType });
            } else {
              ruleSetEditsByRuleSetId.set(context.ruleSetId, {
                context,
                edits: [{ parameterType: context.parameterType, propertyName: context.propertyName, value: newValue, valueType }],
              });
            }
            return;
          }

          const existing = policyEditsByPolicyId.get(context.policyId);
          if (existing) {
            existing.edits.push({ ruleSetIndex: context.ruleSetIndex, inputKey: context.inputKey, value: newValue, valueType });
          } else {
            policyEditsByPolicyId.set(context.policyId, {
              context,
              edits: [{ ruleSetIndex: context.ruleSetIndex, inputKey: context.inputKey, value: newValue, valueType }],
            });
          }
        });

        console.log("[PoliciesGrid] grouped policy save operations", {
          columnIndex,
          ruleSetUpdates: Array.from(ruleSetEditsByRuleSetId, ([ruleSetId, entry]) => ({
            ruleSetId,
            edits: entry.edits,
          })),
          ruleBasedPolicyUpdates: Array.from(policyEditsByPolicyId, ([policyId, entry]) => ({
            policyId,
            edits: entry.edits,
          })),
        });

        for (const [ruleSetId, { context, edits }] of ruleSetEditsByRuleSetId) {
          let ruleSetPayload = context.ruleSet;
          edits.forEach((edit) => {
            ruleSetPayload = applyRuleSetValueUpdate(ruleSetPayload, edit.parameterType, edit.propertyName, edit.value, edit.valueType);
          });

          console.log("[PoliciesGrid] sending rule set update", {
            ruleSetId,
            edits,
            parameterCount: Array.isArray(ruleSetPayload.parameters) ? ruleSetPayload.parameters.length : 0,
          });
          const response = await environmentManagement.updateRuleSet(ruleSetId, ruleSetPayload, {
            connectionTarget: "primary",
          });
          console.log("[PoliciesGrid] rule set update response", { ruleSetId, response });
          const responseObj = response as { errors?: { message?: string } | null; responseMessage?: string };
          if (responseObj.errors || responseObj.responseMessage) {
            throw new Error(responseObj.errors?.message ?? responseObj.responseMessage ?? "Unknown API error");
          }
        }

        for (const [policyId, { context, edits }] of policyEditsByPolicyId) {
          let policyPayload = context.policy;
          const touchedRuleSetIndices = new Set<number>();
          edits.forEach((edit) => {
            policyPayload = applyPolicyInputUpdate(policyPayload, edit.ruleSetIndex, edit.inputKey, edit.value, edit.valueType);
            touchedRuleSetIndices.add(edit.ruleSetIndex);
          });

          const ruleSetsArray = Array.isArray(policyPayload.ruleSets) ? (policyPayload.ruleSets as Array<Record<string, unknown>>) : [];
          const ruleSetsToSend = Array.from(touchedRuleSetIndices)
            .sort((left, right) => left - right)
            .map((ruleSetIndex) => ruleSetsArray[ruleSetIndex])
            .filter((ruleSet): ruleSet is Record<string, unknown> => Boolean(ruleSet));

          console.log("[PoliciesGrid] sending rule-based policy update", {
            policyId,
            edits,
            touchedRuleSetIndices: Array.from(touchedRuleSetIndices).sort((left, right) => left - right),
            ruleSetCount: ruleSetsToSend.length,
          });
          const policyUpdatePayload = {
            ...(context.policy ?? {}),
            id: context.policy.id ?? policyId,
            name: context.policy.name ?? context.policy.displayName ?? context.policy.title ?? policyId,
            ruleSets: ruleSetsToSend,
          } as Record<string, unknown>;

          const response = await environmentManagement.updateRuleBasedPolicy(
            policyId,
            policyUpdatePayload as { id?: string; name?: string; ruleSets: Array<Record<string, unknown>> },
            { connectionTarget: "primary" }
          );
          console.log("[PoliciesGrid] rule-based policy update response", { policyId, response });
          const responseObj = response as { errors?: { message?: string } | null; responseMessage?: string };
          if (responseObj.errors || responseObj.responseMessage) {
            throw new Error(responseObj.errors?.message ?? responseObj.responseMessage ?? "Unknown API error");
          }
        }

        console.log("[PoliciesGrid] policy save completed", {
          columnIndex,
          durationMs: Date.now() - saveStartedAt,
          ruleSetUpdateCount: ruleSetEditsByRuleSetId.size,
          ruleBasedPolicyUpdateCount: policyEditsByPolicyId.size,
        });

        const updateCount = ruleSetEditsByRuleSetId.size + policyEditsByPolicyId.size;
        window.toolboxAPI.utils.showNotification({
          title: "Policy changes saved",
          body: `Saved ${updateCount} rule update(s).`,
          type: "success",
          duration: 3000,
        });

        setRows((prev) =>
          prev.map((row) => {
            const context = columnIndex === 0 ? row.updateContext1 : row.updateContext2;
            if (!row.edit || !context) {
              return row;
            }

            const currentValue = columnIndex === 0 ? row.value1 : row.value2 ?? "";
            const newValue = columnIndex === 0 ? row.newValue1 : row.newValue2;
            if (newValue === currentValue) {
              return row;
            }

            return columnIndex === 0
              ? { ...row, value1: newValue, newValue1: newValue }
              : { ...row, value2: newValue, newValue2: newValue };
          })
        );
      } catch (err) {
        const message = String(err);
        console.error("[PoliciesGrid] policy save failed", {
          columnIndex,
          durationMs: Date.now() - saveStartedAt,
          error: err,
        });
        setSaveError(message);
        window.toolboxAPI.utils.showNotification({
          title: "Failed to save policy changes",
          body: message,
          type: "error",
          duration: 4000,
        });
      } finally {
        setSavingColumn((prev) => ({ ...prev, [columnIndex]: false }));
      }
    },
    [rows]
  );

  const renderEditableCell = React.useCallback(
    (row: PolicyCompareRow, columnIndex: 0 | 1) => {
      const editable = columnIndex === 0 ? row.editable1 : row.editable2;
      const value = columnIndex === 0 ? row.newValue1 : row.newValue2;
      const valueType = columnIndex === 0 ? row.valueType1 : row.valueType2;
      const isEditingColumn = columnIndex === 0 ? row.edit1 : row.edit2;

      if (!isEditingColumn || !editable) {
        return <span>{value}</span>;
      }

      if (valueType === "boolean") {
        const checked = value === "true";
        return (
          <Switch
            checked={checked}
            label={checked ? "Enabled" : "Disabled"}
            onChange={(_, data) => setRowNewValue(row.rowKey, columnIndex, data.checked ? "true" : "false")}
          />
        );
      }

      if (valueType === "number") {
        return (
          <Input
            type="number"
            value={value}
            appearance="outline"
            style={{ width: "100%" }}
            onChange={(_, data) => {
              if (data.value.trim() === "" || /^-?\d*\.?\d*$/.test(data.value)) {
                setRowNewValue(row.rowKey, columnIndex, data.value);
              }
            }}
          />
        );
      }

      return (
        <Input
          value={value}
          appearance="outline"
          style={{ width: "100%" }}
          onChange={(_, data) => setRowNewValue(row.rowKey, columnIndex, data.value)}
        />
      );
    },
    [setRowNewValue]
  );

  const makeSaveHeaderButton = React.useCallback(
    (columnIndex: 0 | 1) =>
      (params: CustomInnerHeaderProps<PolicyCompareRow>) => {
        const hasPendingChanges = rows.some((row) => {
          const isEditingColumn = columnIndex === 0 ? row.edit1 : row.edit2;
          if (!isEditingColumn) {
            return false;
          }

          const context = columnIndex === 0 ? row.updateContext1 : row.updateContext2;
          if (!context) {
            return false;
          }

          const currentValue = columnIndex === 0 ? row.value1 : row.value2 ?? "";
          const newValue = columnIndex === 0 ? row.newValue1 : row.newValue2;
          return newValue !== currentValue;
        });

        return (
          <div className="customInnerHeaderGroup" style={{ display: "flex", alignItems: "center", width: "100%", minWidth: 0 }}>
            <div className="org-grid-header-label" title={params.displayName}>
              {params.displayName}
            </div>
            {hasPendingChanges && (
              <Button icon={<Save20Filled />} disabled={savingColumn[columnIndex]} onClick={() => void handleSave(columnIndex)} />
            )}
          </div>
        );
      },
    [rows, savingColumn, handleSave]
  );

  const getCompareCellStyle = React.useCallback(
    (leftValue?: string, rightValue?: string) => {
      if (!isCompareMode || rightValue === undefined) {
        return undefined;
      }

      const leftText = leftValue ?? "";
      const rightText = rightValue ?? "";

      if (leftText === rightText) {
        return undefined;
      }

      return {
        backgroundColor: "rgba(255, 193, 7, 0.18)",
        borderLeft: "3px solid #ffbf00",
      };
    },
    [isCompareMode]
  );

  const getRowHeight = React.useCallback((params: { data?: PolicyCompareRow }) => {
    const row = params.data;
    if (!row) {
      return 42;
    }

    const texts = [
      row.ruleSetId ?? "",
      row.value1 ?? "",
      row.newValue1 ?? "",
      row.value2 ?? "",
      row.newValue2 ?? "",
      row.description ?? "",
      row.connectorName ?? "",
    ].filter((value) => value && value.length > 0);

    if (texts.length === 0) {
      return 42;
    }

    const longestText = texts.reduce((longest, current) => (current.length > longest.length ? current : longest), "");
    const estimatedCharsPerLine = 52;
    const estimatedLines = Math.max(1, Math.ceil((longestText.length || 1) / estimatedCharsPerLine));

    if (estimatedLines <= 1) {
      return 42;
    }

    return Math.max(42, (estimatedLines - 1) * 18 + 42);
  }, []);

  const columnDefs = React.useMemo(() => {
    const editIcon = (params: CustomCellRendererProps<PolicyCompareRow>) => {
      const row = params.data;
      if (!row || (!row.editable1 && !row.editable2)) {
        return null;
      }

      const isEditing = row.edit1 || row.edit2;
      return isEditing ? (
        <Button icon={<ArrowUndoRegular />} onClick={() => setRowEdit(row.rowKey, false)} />
      ) : (
        <Button icon={<EditRegular />} onClick={() => setRowEdit(row.rowKey, true)} />
      );
    };

    const groupColumns: ColGroupDef<PolicyCompareRow>[] = [
      {
        headerName: isCompareMode ? groupNames[0] : "Value",
        children: [
          {
            field: "value1",
            headerName: "Current Value",
            flex: 1,
            minWidth: 160,
            filter: true,
            sortable: false,
            wrapText: true,
            autoHeight: true,
            cellStyle: (params: { data?: PolicyCompareRow }) =>
              getCompareCellStyle(params.data?.value1, params.data?.value2),
            cellRenderer: (params: { value?: string }) => params.value ?? "",
          },
          {
            colId: "newValue1",
            field: "newValue1",
            headerName: "New Value",
            flex: 1,
            minWidth: 160,
            wrapText: true,
            autoHeight: true,
            headerComponent: makeSaveHeaderButton(0),
            cellStyle: (params: { data?: PolicyCompareRow }) =>
              getCompareCellStyle(params.data?.newValue1, params.data?.newValue2),
            cellRenderer: (params: { data?: PolicyCompareRow }) => (params.data ? renderEditableCell(params.data, 0) : null),
          },
        ],
      },
    ];

    if (isCompareMode) {
      groupColumns.push({
        headerName: groupNames[1],
        children: [
          {
            field: "value2",
            headerName: "Current Value",
            flex: 1,
            minWidth: 160,
            filter: true,
            sortable: false,
            wrapText: true,
            autoHeight: true,
            cellStyle: (params: { data?: PolicyCompareRow }) =>
              getCompareCellStyle(params.data?.value2, params.data?.value1),
            cellRenderer: (params: { value?: string }) => params.value ?? "",
          },
          {
            colId: "newValue2",
            field: "newValue2",
            headerName: "New Value",
            flex: 1,
            minWidth: 160,
            wrapText: true,
            autoHeight: true,
            headerComponent: makeSaveHeaderButton(1),
            cellStyle: (params: { data?: PolicyCompareRow }) =>
              getCompareCellStyle(params.data?.newValue2, params.data?.newValue1),
            cellRenderer: (params: { data?: PolicyCompareRow }) => (params.data ? renderEditableCell(params.data, 1) : null),
          },
        ],
      });
    }

    return [
      {
        colId: "Edit",
        headerName: "",
        resizable: false,
        width: 64,
        minWidth: 64,
        maxWidth: 64,
        sortable: false,
        cellRenderer: editIcon,
      },
      {
        colId: "Info",
        headerName: "",
        resizable: false,
        width: 64,
        minWidth: 64,
        maxWidth: 64,
        sortable: false,
        cellRenderer: (params: CustomCellRendererProps<PolicyCompareRow>) => {
          const row = params.data;
          if (!row || (!row.displayName && !row.description)) {
            return null;
          }

          const fullName = row.displayName || row.ruleSetId;
          const name = fullName.includes(" / ") ? fullName.slice(fullName.lastIndexOf(" / ") + 3) : fullName;

          return (
            <RuleSetInfoPopup
              name={name}
              description={row.description}
              isPreview={row.isPreview}
              learnMoreText={row.learnMoreText}
              learnMoreLink={row.learnMoreLink}
            />
          );
        },
      },
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
      ...groupColumns,
    ] as (ColDef<PolicyCompareRow> | ColGroupDef<PolicyCompareRow>)[];
  }, [groupNames, isCompareMode, makeSaveHeaderButton, renderEditableCell, setRowEdit]);

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

      {saveError && (
        <div className="info-box warning">
          <p>
            <strong>Unable to save policy changes</strong>
            <br />
            {saveError}
          </p>
        </div>
      )}

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
            defaultColDef={{ wrapText: true, autoHeight: true }}
            domLayout="normal"
            getRowHeight={getRowHeight}
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
