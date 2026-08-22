import React from "react";
import {
  AgGridReact,
  CustomCellRendererProps,
  CustomInnerHeaderProps,
} from "ag-grid-react";
import {
  Button,
  Checkbox,
  Input,
  Select,
  Switch,
} from "@fluentui/react-components";
import {
  AddRegular,
  ArrowLeft16Regular,
  ArrowUndoRegular,
  DocumentBulletListRegular,
  EditRegular,
  PlugConnectedRegular,
  Save20Filled,
} from "@fluentui/react-icons";
import {
  CellStyleModule,
  ColGroupDef,
  GetRowIdParams,
  ModuleRegistry,
  RenderApiModule,
  RowAutoHeightModule,
  RowSelectionModule,
  Theme,
  ValidationModule,
} from "ag-grid-community";
import { EnvironmentGroupRow } from "./EnvironmentGroupsList";
import {
  EnvGroupPolicyConnectorRow,
  EnvGroupRuleRow,
  EnvMgmt,
} from "../utils/envMgmt";
import { environmentManagement } from "../utils/environmentManagement";
import { RuleSetInfoPopup } from "./Info";
import { KnowledgeSourceEditor } from "./KnowledgeSourceEditor";
import { ConnectorsGrid } from "./ConnectorsGrid";
import { comparisonValuesDiffer } from "./ComparisonFilterButton";

ModuleRegistry.registerModules([
  RowAutoHeightModule,
  ValidationModule,
  CellStyleModule,
  RenderApiModule,
  RowSelectionModule,
]);

interface PoliciesGridProps {
  groups: EnvironmentGroupRow[];
  theme?: Theme | "legacy";
  showOnlyDifferences: boolean;
  onBack: () => void;
}

interface PolicyCompareRow {
  rowKey: string;
  primaryRule?: EnvGroupRuleRow;
  secondaryRule?: EnvGroupRuleRow;
  shortDescription: string;
  ruleId: string;
  longDescription: string;
}

function getRuleKey(rule: EnvGroupRuleRow): string {
  return rule.ruleType === "policy"
    ? `policy::${rule.groupId}::${rule.ruleId}`.toLowerCase()
    : `ruleSet::${rule.type}::${rule.resourceType}::${rule.ruleId}`.toLowerCase();
}

function getPolicyRowId(params: GetRowIdParams<PolicyCompareRow>): string {
  return params.data.rowKey;
}

function isDependencyChildOf(
  child: EnvGroupRuleRow,
  parent: EnvGroupRuleRow,
): boolean {
  if (
    !child.parentRuleId ||
    child.groupId.toLowerCase() !== parent.groupId.toLowerCase() ||
    (child.ruleType === "ruleSet" &&
      parent.ruleType === "ruleSet" &&
      child.resourceType.toLowerCase() !== parent.resourceType.toLowerCase())
  ) {
    return false;
  }

  const parentRuleId = parent.ruleId.toLowerCase();
  const configuredParentId = child.parentRuleId.toLowerCase();
  return (
    configuredParentId === parentRuleId ||
    configuredParentId ===
      `${parent.resourceType}_${parent.ruleId}`.toLowerCase()
  );
}

function isDependencyLocked(
  rule: EnvGroupRuleRow,
  rules: EnvGroupRuleRow[],
): boolean {
  if (!rule.parentRuleId) {
    return false;
  }

  const parent = rules.find((candidate) =>
    isDependencyChildOf(rule, candidate),
  );

  return Boolean(
    parent &&
    parent.childEnabledValue !== undefined &&
    String(parent.newValueString ?? parent.currentValueString)
      .trim()
      .toLowerCase() !== String(parent.childEnabledValue).trim().toLowerCase(),
  );
}

function applyDependencyUpdates(
  rules: EnvGroupRuleRow[],
  changedRule: EnvGroupRuleRow,
): EnvGroupRuleRow[] {
  return rules.map((rule) => {
    if (!isDependencyChildOf(rule, changedRule)) {
      return rule;
    }

    const parent = changedRule;

    if (
      parent &&
      isDependencyLocked(rule, rules) &&
      parent.childValueWhenDisabled !== undefined
    ) {
      const newValueString = String(parent.childValueWhenDisabled);
      return {
        ...rule,
        edit: newValueString !== rule.currentValueString,
        dependencyUpdate: newValueString !== rule.currentValueString,
        newValueString,
      };
    }

    return rule.dependencyUpdate
      ? {
          ...rule,
          edit: false,
          dependencyUpdate: false,
          newValueString: rule.currentValueString,
        }
      : rule;
  });
}

function coerceRuleValue(row: EnvGroupRuleRow): string | number | boolean {
  if (row.dataType === "boolean") {
    return row.newValueString.trim().toLowerCase() === "true";
  }

  if (row.dataType === "number") {
    const value = Number(row.newValueString);
    if (
      row.value?.allowNoLimit &&
      value !== -1 &&
      (value < (row.value.min ?? 1) || value > (row.value.max ?? 99))
    ) {
      throw new Error(
        `${row.shortDescription} must be -1 or between ${row.value.min ?? 1} and ${row.value.max ?? 99}.`,
      );
    }
    return Number.isFinite(value) ? value : row.newValueString;
  }

  if (row.dataType === "choice" && row.value?.value === "choiceNumber") {
    const value = Number(row.newValueString);
    return Number.isFinite(value) ? value : row.newValueString;
  }

  return row.newValueString;
}

function getCreateValue(rule: EnvGroupRuleRow): string {
  if (rule.policyEditor === "knowledgeSourceUrls") {
    return JSON.stringify([{ url: "*", order: 1, behavior: "Deny" }]);
  }

  if (rule.dataType === "boolean") {
    return "false";
  }

  if (rule.dataType === "number") {
    return String(rule.value?.allowNoLimit ? -1 : (rule.value?.min ?? 0));
  }

  if (rule.dataType === "choice") {
    const choices = rule.value?.choices ?? [];
    const defaultChoice = choices.find((choice) => choice.default);
    return String(
      defaultChoice?.value ??
        choices.find((choice) => choice.visible !== false)?.value ??
        "",
    );
  }

  return "";
}

function getRuleValueLabel(rule: EnvGroupRuleRow, value: string): string {
  if (
    rule.dataType === "number" &&
    rule.value?.allowNoLimit &&
    value === "-1"
  ) {
    return "No limit";
  }

  if (rule.policyEditor === "knowledgeSourceUrls") {
    return KnowledgeSourceEditor.getValueLabel(value);
  }

  return rule.dataType === "choice"
    ? (rule.value?.choices?.find((choice) => String(choice.value) === value)
        ?.label ?? value)
    : value;
}

function renderRuleValue(
  rule: EnvGroupRuleRow,
  value: string,
): React.ReactNode {
  if (rule.policyEditor !== "knowledgeSourceUrls") {
    return getRuleValueLabel(rule, value);
  }

  return KnowledgeSourceEditor.renderValue(value);
}

function setNestedValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split(".");
  let current = target;

  for (const key of keys.slice(0, -1)) {
    current[key] =
      current[key] && typeof current[key] === "object" ? current[key] : {};
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}

function applyRuleValueUpdate(
  ruleSet: Record<string, unknown>,
  row: EnvGroupRuleRow,
): Record<string, unknown> {
  const context = row.updateContext!;
  if (context.kind !== "ruleSet") {
    return ruleSet;
  }
  const clone = JSON.parse(JSON.stringify(ruleSet)) as Record<string, unknown>;
  const parameters = Array.isArray(clone.parameters)
    ? (clone.parameters as Record<string, unknown>[])
    : [];
  clone.parameters = parameters;

  let parameter = parameters.find(
    (item) =>
      String(item.type ?? "").toLowerCase() ===
        context.parameterType.toLowerCase() &&
      String(item.resourceType ?? "NotSpecified").toLowerCase() ===
        context.resourceType.toLowerCase(),
  );

  if (!parameter) {
    parameter = {
      type: context.parameterType,
      resourceType: context.resourceType,
      value: [],
    };
    parameters.push(parameter);
  }

  const values = Array.isArray(parameter.value)
    ? (parameter.value as Record<string, unknown>[])
    : [];
  parameter.value = values;
  const value = values.find(
    (item) =>
      String(item.id ?? "").toLowerCase() ===
      context.propertyName.toLowerCase(),
  );

  if (value) {
    value.value = coerceRuleValue(row);
  } else {
    values.push({ id: context.propertyName, value: coerceRuleValue(row) });
  }

  return clone;
}

function applyPolicyValueUpdate(
  policy: Record<string, unknown>,
  row: EnvGroupRuleRow,
): Record<string, unknown> {
  const context = row.updateContext!;
  if (context.kind !== "policy") {
    return policy;
  }

  const clone = JSON.parse(JSON.stringify(policy)) as Record<string, unknown>;
  const ruleSet = Array.isArray(clone.ruleSets)
    ? (clone.ruleSets[context.ruleSetIndex] as
        | Record<string, unknown>
        | undefined)
    : undefined;

  if (!ruleSet) {
    throw new Error(`Policy rule set not found for ${row.ruleId}`);
  }

  const inputs =
    ruleSet.inputs && typeof ruleSet.inputs === "object"
      ? (ruleSet.inputs as Record<string, unknown>)
      : {};
  ruleSet.inputs = inputs;
  const currentValue = inputs[context.inputKey];

  if (row.policyValuePath) {
    const input =
      currentValue && typeof currentValue === "object"
        ? (JSON.parse(JSON.stringify(currentValue)) as Record<string, unknown>)
        : {};

    try {
      setNestedValue(
        input,
        row.policyValuePath,
        row.policyEditor === "knowledgeSourceUrls"
          ? KnowledgeSourceEditor.canonicalizeRules(row.newValueString)
          : coerceRuleValue(row),
      );
    } catch {
      throw new Error(`${row.shortDescription} contains invalid rules.`);
    }
    inputs[context.inputKey] = input;
  } else if (currentValue !== null && typeof currentValue === "object") {
    if (
      !Array.isArray(currentValue) &&
      row.value?.id &&
      row.dataType === "choice"
    ) {
      inputs[context.inputKey] = {
        ...(currentValue as Record<string, unknown>),
        [row.value.id]: coerceRuleValue(row),
      };
    } else {
      try {
        inputs[context.inputKey] = JSON.parse(row.newValueString);
      } catch {
        throw new Error(`${row.shortDescription} must contain valid JSON.`);
      }
    }
  } else if (
    row.dataType === "choice" &&
    row.value?.id &&
    row.value.id.toLowerCase() !== context.inputKey.toLowerCase()
  ) {
    inputs[context.inputKey] = {
      [row.value.id]: coerceRuleValue(row),
    };
  } else {
    inputs[context.inputKey] = coerceRuleValue(row);
  }

  return clone;
}

export const PoliciesGrid = React.memo(
  ({
    groups,
    theme = "legacy",
    showOnlyDifferences,
    onBack,
  }: PoliciesGridProps): React.JSX.Element => {
    const [loadedRules, setLoadedRules] = React.useState<
      EnvGroupRuleRow[] | null
    >(null);
    const [secondaryRules, setSecondaryRules] = React.useState<
      EnvGroupRuleRow[] | null
    >(null);
    const [connectors, setConnectors] = React.useState<
      EnvGroupPolicyConnectorRow[]
    >([]);
    const [secondaryConnectors, setSecondaryConnectors] = React.useState<
      EnvGroupPolicyConnectorRow[]
    >([]);
    const [view, setView] = React.useState<"policies" | "connectors">(
      "policies",
    );
    const [saving, setSaving] = React.useState(false);
    const [savingSecondary, setSavingSecondary] = React.useState(false);
    const knowledgeEditorRef = React.useRef<KnowledgeSourceEditor>(null);
    const knowledgeEditorSecondaryRef = React.useRef(false);
    const updateRules = React.useCallback(
      (
        secondary: boolean,
        updater: (rows: EnvGroupRuleRow[] | null) => EnvGroupRuleRow[] | null,
      ) =>
        secondary
          ? setSecondaryRules((rows) => updater(rows))
          : setLoadedRules((rows) => updater(rows)),
      [],
    );
    const applyKnowledgeSourceValue = React.useCallback(
      (rule: EnvGroupRuleRow, value: string) =>
        updateRules(
          knowledgeEditorSecondaryRef.current,
          (rows) =>
            rows?.map((row) =>
              row.groupId === rule.groupId && row.ruleId === rule.ruleId
                ? {
                    ...row,
                    edit: value !== row.currentValueString,
                    newValueString: value,
                  }
                : row,
            ) ?? null,
        ),
      [updateRules],
    );

    const setRowEdit = React.useCallback(
      (rule: EnvGroupRuleRow, edit: boolean, secondary = false) => {
        updateRules(secondary, (rows) => {
          const updatedRows =
            rows?.map((row) =>
              row === rule
                ? {
                    ...row,
                    edit,
                    newValueString:
                      edit && row.isNew
                        ? getCreateValue(row)
                        : edit &&
                            row.dataType === "number" &&
                            row.value?.allowNoLimit &&
                            row.currentValueString !== "-1" &&
                            (Number(row.currentValueString) <
                              (row.value.min ?? 1) ||
                              Number(row.currentValueString) >
                                (row.value.max ?? 99))
                          ? String(row.value.min ?? 1)
                          : row.currentValueString,
                  }
                : row,
            ) ?? null;

          return !edit && updatedRows
            ? updatedRows.map((row) =>
                row.dependencyUpdate && isDependencyChildOf(row, rule)
                  ? {
                      ...row,
                      edit: false,
                      dependencyUpdate: false,
                      newValueString: row.currentValueString,
                    }
                  : row,
              )
            : updatedRows;
        });
      },
      [updateRules],
    );

    const setNewValue = React.useCallback(
      (rule: EnvGroupRuleRow, value: string, secondary = false) => {
        updateRules(secondary, (rows) => {
          const updatedRows =
            rows?.map((row) =>
              row === rule ? { ...row, newValueString: value } : row,
            ) ?? null;

          return updatedRows
            ? applyDependencyUpdates(
                updatedRows,
                updatedRows.find(
                  (row) => getRuleKey(row) === getRuleKey(rule),
                ) ?? rule,
              )
            : null;
        });
      },
      [updateRules],
    );

    const saveChanges = React.useCallback(
      async (secondary = false) => {
        const rules = secondary ? secondaryRules : loadedRules;
        const group = groups[secondary ? 1 : 0];
        const changedRows = (rules ?? []).filter(
          (row) =>
            row.edit &&
            row.updateContext &&
            (row.dependencyUpdate || !isDependencyLocked(row, rules ?? [])) &&
            row.newValueString !== row.currentValueString,
        );

        if (changedRows.length === 0) {
          console.log("[PoliciesGrid] save skipped: no changed editable rows");
          return;
        }

        const saveStartedAt = Date.now();
        console.log("[PoliciesGrid] starting policy save", {
          environmentGroupId: group?.environmentGroupId,
          changedRows: changedRows.map((row) => ({
            ruleId: row.ruleId,
            groupId: row.groupId,
            updateKind: row.updateContext?.kind,
          })),
        });
        secondary ? setSavingSecondary(true) : setSaving(true);
        try {
          const updates = new Map<
            string,
            { payload: Record<string, unknown>; rows: EnvGroupRuleRow[] }
          >();
          const policyUpdates = new Map<
            string,
            {
              payload: Record<string, unknown>;
              rows: EnvGroupRuleRow[];
              ruleSetIndices: Set<number>;
            }
          >();

          for (const row of changedRows) {
            const context = row.updateContext!;
            if (context.kind === "policy") {
              const update = policyUpdates.get(context.policyId) ?? {
                payload: context.policy,
                rows: [],
                ruleSetIndices: new Set<number>(),
              };
              update.payload = applyPolicyValueUpdate(update.payload, row);
              update.rows.push(row);
              update.ruleSetIndices.add(context.ruleSetIndex);
              policyUpdates.set(context.policyId, update);
              continue;
            } else if (context.kind === "ruleSet") {
              const update = updates.get(context.ruleSetId) ?? {
                payload: context.ruleSet,
                rows: [],
              };
              update.payload = applyRuleValueUpdate(update.payload, row);
              update.rows.push(row);
              updates.set(context.ruleSetId, update);
            }
          }

          console.log("[PoliciesGrid] grouped policy save operations", {
            ruleSetUpdates: Array.from(updates, ([ruleSetId, update]) => ({
              ruleSetId,
              ruleIds: update.rows.map((row) => row.ruleId),
            })),
            ruleBasedPolicyUpdates: Array.from(
              policyUpdates,
              ([policyId, update]) => ({
                policyId,
                ruleIds: update.rows.map((row) => row.ruleId),
                ruleSetIndices: Array.from(update.ruleSetIndices).sort(
                  (left, right) => left - right,
                ),
              }),
            ),
          });

          for (const [ruleSetId, update] of updates) {
            console.log("[PoliciesGrid] sending rule set update", {
              ruleSetId,
              ruleIds: update.rows.map((row) => row.ruleId),
              parameterCount: Array.isArray(update.payload.parameters)
                ? update.payload.parameters.length
                : 0,
            });
            const response = await environmentManagement.updateRuleSet(
              ruleSetId,
              update.payload,
              { connectionTarget: "primary" },
            );
            console.log("[PoliciesGrid] rule set update response", {
              ruleSetId,
              response,
            });
            const result = response as {
              errors?: { message?: string } | null;
              responseMessage?: string;
            };
            if (result.errors || result.responseMessage) {
              throw new Error(
                result.errors?.message ??
                  result.responseMessage ??
                  "Unknown API error",
              );
            }
          }

          for (const [policyId, update] of policyUpdates) {
            const ruleSets = Array.isArray(update.payload.ruleSets)
              ? (update.payload.ruleSets as Record<string, unknown>[])
              : [];
            console.log("[PoliciesGrid] sending rule-based policy update", {
              policyId,
              ruleIds: update.rows.map((row) => row.ruleId),
              ruleSetIndices: Array.from(update.ruleSetIndices).sort(
                (left, right) => left - right,
              ),
              ruleSetCount: update.ruleSetIndices.size,
            });
            const response = await environmentManagement.updateRuleBasedPolicy(
              policyId,
              {
                ...update.payload,
                id: String(update.payload.id ?? policyId),
                name: String(
                  update.payload.name ??
                    update.payload.displayName ??
                    update.payload.title ??
                    policyId,
                ),
                ruleSets: Array.from(update.ruleSetIndices)
                  .sort((left, right) => left - right)
                  .map((index) => ruleSets[index])
                  .filter((ruleSet): ruleSet is Record<string, unknown> =>
                    Boolean(ruleSet),
                  ),
              },
              { connectionTarget: "primary" },
            );
            console.log("[PoliciesGrid] rule-based policy update response", {
              policyId,
              response,
            });
            const result = response as {
              errors?: { message?: string } | null;
              responseMessage?: string;
            };
            if (result.errors || result.responseMessage) {
              throw new Error(
                result.errors?.message ??
                  result.responseMessage ??
                  "Unknown API error",
              );
            }
          }

          console.log("[PoliciesGrid] policy save completed", {
            environmentGroupId: group?.environmentGroupId,
            durationMs: Date.now() - saveStartedAt,
            changedRowCount: changedRows.length,
            ruleSetUpdateCount: updates.size,
            ruleBasedPolicyUpdateCount: policyUpdates.size,
          });

          const changed = new Set(changedRows);
          updateRules(
            secondary,
            (rows) =>
              rows?.map((row) =>
                changed.has(row)
                  ? {
                      ...row,
                      currentValueString: row.newValueString,
                      edit: false,
                      isNew: false,
                      dependencyUpdate: false,
                    }
                  : row,
              ) ?? null,
          );
          window.toolboxAPI.utils.showNotification({
            title: "Policy changes saved",
            body: `Saved ${changedRows.length} policy value(s) for ${group?.displayName ?? "environment group"}.`,
            type: "success",
            duration: 3000,
          });
        } catch (error) {
          console.error("[PoliciesGrid] policy save failed", {
            environmentGroupId: group?.environmentGroupId,
            durationMs: Date.now() - saveStartedAt,
            error,
          });
          window.toolboxAPI.utils.showNotification({
            title: "Failed to save policy changes",
            body: String(error),
            type: "error",
            duration: 4000,
          });
        } finally {
          secondary ? setSavingSecondary(false) : setSaving(false);
        }
      },
      [groups, loadedRules, secondaryRules, updateRules],
    );

    const renderNewValue = React.useCallback(
      (rule: EnvGroupRuleRow, secondary = false) => {
        const rules = secondary ? secondaryRules : loadedRules;
        if (rule.policyEditor === "knowledgeSourceUrls") {
          return rule.edit &&
            getRuleValueLabel(rule, rule.newValueString) === "Custom" ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                minWidth: 0,
                width: "100%",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {renderRuleValue(rule, rule.newValueString)}
              </div>
              <Button
                appearance="subtle"
                icon={<EditRegular />}
                aria-label={`Edit ${rule.shortDescription}`}
                onClick={() => {
                  knowledgeEditorSecondaryRef.current = secondary;
                  knowledgeEditorRef.current?.open(rule);
                }}
              />
            </div>
          ) : (
            getRuleValueLabel(rule, rule.newValueString)
          );
        }

        if (!rule.edit || isDependencyLocked(rule, rules ?? [])) {
          return getRuleValueLabel(rule, rule.newValueString);
        }

        if (rule.dataType === "boolean") {
          const checked = rule.newValueString.toLowerCase() === "true";
          return (
            <Switch
              checked={checked}
              label={checked ? "Enabled" : "Disabled"}
              onChange={(_, data) =>
                setNewValue(rule, data.checked ? "true" : "false", secondary)
              }
            />
          );
        }

        if (rule.dataType === "number" && rule.value?.allowNoLimit) {
          const noLimit = rule.newValueString === "-1";
          const min = rule.value.min ?? 1;
          const max = rule.value.max ?? 99;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Checkbox
                checked={noLimit}
                label="No limit"
                onChange={(_, data) =>
                  setNewValue(
                    rule,
                    data.checked
                      ? "-1"
                      : String(
                          Math.min(
                            max,
                            Math.max(min, Number(rule.currentValueString)),
                          ) || min,
                        ),
                    secondary,
                  )
                }
              />
              <Input
                type="number"
                min={min}
                max={max}
                disabled={noLimit}
                value={noLimit ? "" : rule.newValueString}
                aria-label={`${rule.shortDescription} limit`}
                style={{ width: 100 }}
                onChange={(_, data) => {
                  const value = Number(data.value);
                  if (Number.isInteger(value) && value >= min && value <= max) {
                    setNewValue(rule, data.value, secondary);
                  }
                }}
              />
            </div>
          );
        }

        if (rule.dataType === "choice" && rule.value?.choices?.length) {
          return (
            <Select
              value={rule.newValueString}
              onChange={(_, data) => setNewValue(rule, data.value, secondary)}
            >
              {rule.value.choices
                .filter(
                  (choice) =>
                    choice.visible !== false ||
                    String(choice.value) === rule.newValueString,
                )
                .map((choice) => (
                  <option
                    key={String(choice.value)}
                    value={String(choice.value)}
                    hidden={choice.visible === false}
                  >
                    {choice.label}
                  </option>
                ))}
            </Select>
          );
        }

        return (
          <Input
            type={rule.dataType === "number" ? "number" : "text"}
            value={rule.newValueString}
            style={{ width: "100%" }}
            onChange={(_, data) => setNewValue(rule, data.value, secondary)}
          />
        );
      },
      [loadedRules, secondaryRules, setNewValue],
    );

    const compareRows = React.useMemo(() => {
      const rowsByKey = new Map<string, PolicyCompareRow>();

      for (const rule of loadedRules ?? []) {
        const rowKey = getRuleKey(rule);
        rowsByKey.set(rowKey, {
          rowKey,
          primaryRule: rule,
          shortDescription: rule.shortDescription,
          ruleId: rule.ruleId,
          longDescription: rule.longDescription,
        });
      }

      for (const rule of secondaryRules ?? []) {
        const rowKey = getRuleKey(rule);
        const existing = rowsByKey.get(rowKey);
        rowsByKey.set(rowKey, {
          rowKey,
          primaryRule: existing?.primaryRule,
          secondaryRule: rule,
          shortDescription: existing?.shortDescription ?? rule.shortDescription,
          ruleId: existing?.ruleId ?? rule.ruleId,
          longDescription: existing?.longDescription ?? rule.longDescription,
        });
      }

      return Array.from(rowsByKey.values());
    }, [loadedRules, secondaryRules]);
    const visibleCompareRows =
      groups[1] && showOnlyDifferences
        ? compareRows.filter(
            (row) =>
              comparisonValuesDiffer(
                row.primaryRule?.currentValueString,
                row.secondaryRule?.currentValueString,
              ) ||
              comparisonValuesDiffer(
                row.primaryRule?.newValueString,
                row.secondaryRule?.newValueString,
              ),
          )
        : compareRows;

    const getCompareCellStyle = React.useCallback(
      (leftValue: string | undefined, rightValue: string | undefined) => {
        if (!groups[1]) {
          return undefined;
        }

        if ((leftValue ?? "") === (rightValue ?? "")) {
          return undefined;
        }

        return {
          backgroundColor: "rgba(255, 193, 7, 0.18)",
          borderLeft: "3px solid #ffbf00",
        };
      },
      [groups],
    );

    const saveHeader = React.useCallback(
      (params: CustomInnerHeaderProps<PolicyCompareRow>) => {
        const hasChanges = (loadedRules ?? []).some(
          (row) =>
            row.edit &&
            (row.dependencyUpdate ||
              !isDependencyLocked(row, loadedRules ?? [])) &&
            row.newValueString !== row.currentValueString,
        );
        return (
          <div
            className="customInnerHeaderGroup"
            style={{ display: "flex", alignItems: "center", width: "100%" }}
          >
            <div className="org-grid-header-label" title={params.displayName}>
              {params.displayName}
            </div>
            {hasChanges && (
              <Button
                icon={<Save20Filled />}
                disabled={saving}
                aria-label="Save policy changes"
                onClick={() => void saveChanges()}
              />
            )}
          </div>
        );
      },
      [loadedRules, saveChanges, saving],
    );

    const saveHeaderSecondary = React.useCallback(
      (params: CustomInnerHeaderProps<PolicyCompareRow>) => {
        const hasChanges = (secondaryRules ?? []).some(
          (row) =>
            row.edit &&
            (row.dependencyUpdate ||
              !isDependencyLocked(row, secondaryRules ?? [])) &&
            row.newValueString !== row.currentValueString,
        );
        return (
          <div
            className="customInnerHeaderGroup"
            style={{ display: "flex", alignItems: "center", width: "100%" }}
          >
            <div className="org-grid-header-label" title={params.displayName}>
              {params.displayName}
            </div>
            {hasChanges && (
              <Button
                icon={<Save20Filled />}
                disabled={savingSecondary}
                aria-label="Save secondary group policy changes"
                onClick={() => void saveChanges(true)}
              />
            )}
          </div>
        );
      },
      [saveChanges, savingSecondary, secondaryRules],
    );

    const renderEditButton = React.useCallback(
      (rule: EnvGroupRuleRow | undefined, secondary: boolean) => {
        const rules = secondary ? secondaryRules : loadedRules;
        if (!rule?.editable || isDependencyLocked(rule, rules ?? [])) {
          return null;
        }

        return rule.edit ? (
          <Button
            icon={<ArrowUndoRegular />}
            aria-label={`Cancel editing ${rule.shortDescription}`}
            onClick={() => setRowEdit(rule, false, secondary)}
          />
        ) : (
          <Button
            icon={rule.isNew ? <AddRegular /> : <EditRegular />}
            aria-label={`${rule.isNew ? "Create" : "Edit"} ${rule.shortDescription}`}
            onClick={() => {
              if (rule.policyEditor === "knowledgeSourceUrls") {
                knowledgeEditorSecondaryRef.current = secondary;
                knowledgeEditorRef.current?.open(
                  rule.isNew
                    ? { ...rule, newValueString: getCreateValue(rule) }
                    : rule,
                );
              } else {
                setRowEdit(rule, true, secondary);
              }
            }}
          />
        );
      },
      [loadedRules, secondaryRules, setRowEdit],
    );

    const policyGridColumnDefs = React.useMemo<
      ColGroupDef<PolicyCompareRow>[]
    >(() => {
      const groupColumns = (
        secondary: boolean,
      ): ColGroupDef<PolicyCompareRow> => ({
        headerName:
          groups[secondary ? 1 : 0]?.displayName ??
          (secondary ? "Secondary Group" : "Primary Group"),
        children: [
          {
            colId: secondary ? "SecondaryEdit" : "PrimaryEdit",
            headerName: "",
            width: 64,
            minWidth: 64,
            maxWidth: 64,
            sortable: false,
            filter: false,
            resizable: false,
            cellRenderer: (params: CustomCellRendererProps<PolicyCompareRow>) =>
              renderEditButton(
                secondary
                  ? params.data?.secondaryRule
                  : params.data?.primaryRule,
                secondary,
              ),
          },
          {
            colId: secondary ? "SecondaryCurrent" : "PrimaryCurrent",
            headerName: "Current Value",
            flex: 1,
            minWidth: 160,
            cellStyle: (params) =>
              getCompareCellStyle(
                secondary
                  ? params.data?.secondaryRule?.currentValueString
                  : params.data?.primaryRule?.currentValueString,
                secondary
                  ? params.data?.primaryRule?.currentValueString
                  : params.data?.secondaryRule?.currentValueString,
              ),
            cellRenderer: (
              params: CustomCellRendererProps<PolicyCompareRow>,
            ) => {
              const rule = secondary
                ? params.data?.secondaryRule
                : params.data?.primaryRule;
              return rule
                ? renderRuleValue(rule, rule.currentValueString)
                : null;
            },
          },
          {
            colId: secondary ? "SecondaryNew" : "PrimaryNew",
            headerName: "New Value",
            headerComponent: secondary ? saveHeaderSecondary : saveHeader,
            flex: 1,
            minWidth: 160,
            cellStyle: (params) =>
              getCompareCellStyle(
                secondary
                  ? params.data?.secondaryRule?.newValueString
                  : params.data?.primaryRule?.newValueString,
                secondary
                  ? params.data?.primaryRule?.newValueString
                  : params.data?.secondaryRule?.newValueString,
              ),
            cellRenderer: (
              params: CustomCellRendererProps<PolicyCompareRow>,
            ) => {
              const rule = secondary
                ? params.data?.secondaryRule
                : params.data?.primaryRule;
              return rule ? renderNewValue(rule, secondary) : null;
            },
          },
        ],
      });

      return [
        {
          headerName: "",
          children: [
            {
              colId: "Info",
              headerName: "",
              width: 64,
              minWidth: 64,
              maxWidth: 64,
              sortable: false,
              filter: false,
              resizable: false,
              cellRenderer: (
                params: CustomCellRendererProps<PolicyCompareRow>,
              ) =>
                params.data ? (
                  <div className="imgCellInfo">
                    <RuleSetInfoPopup
                      name={params.data.ruleId}
                      description={params.data.longDescription}
                    />
                  </div>
                ) : null,
            },
            {
              field: "shortDescription",
              headerName: "Name",
              initialSort: "asc",
              flex: 2,
              minWidth: 220,
            },
          ],
        },
        groupColumns(false),
        ...(groups[1] ? [groupColumns(true)] : []),
      ];
    }, [
      getCompareCellStyle,
      groups,
      renderEditButton,
      renderNewValue,
      saveHeader,
      saveHeaderSecondary,
    ]);

    React.useEffect(() => {
      let cancelled = false;
      const loadPolicies = async () => {
        if (!groups[0]) {
          setLoadedRules([]);
          setSecondaryRules(null);
          setConnectors([]);
          setSecondaryConnectors([]);
          return;
        }
        const envMgmt = new EnvMgmt();
        const [loadedResult, secondaryResult] = await Promise.all([
          envMgmt.getEnvGroupRules(groups[0].environmentGroupId, "primary"),
          groups[1]
            ? envMgmt.getEnvGroupRules(groups[1].environmentGroupId, "primary")
            : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setLoadedRules(loadedResult.rules);
          setSecondaryRules(secondaryResult?.rules ?? null);
          setConnectors(loadedResult.connectors);
          setSecondaryConnectors(secondaryResult?.connectors ?? []);
        }
      };

      setView("policies");
      void loadPolicies();
      return () => {
        cancelled = true;
      };
    }, [groups]);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          height: "100%",
          minHeight: 0,
        }}
      >
        <KnowledgeSourceEditor
          ref={knowledgeEditorRef}
          onApply={applyKnowledgeSourceValue}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button
            appearance="subtle"
            icon={<ArrowLeft16Regular />}
            onClick={onBack}
          >
            Back to groups
          </Button>
          <div
            style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {groups[1]
                ? `${groups[0]?.displayName} compared with ${groups[1].displayName}`
                : (groups[0]?.displayName ?? "Environment group policies")}
            </div>
            {groups[0] && (
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.8,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {groups[1]
                  ? `${groups[0].environmentGroupId} / ${groups[1].environmentGroupId}`
                  : groups[0].environmentGroupId}
              </div>
            )}
          </div>
          <Button
            appearance="subtle"
            style={{ marginLeft: "auto" }}
            icon={
              view === "policies" ? (
                <PlugConnectedRegular />
              ) : (
                <DocumentBulletListRegular />
              )
            }
            aria-label={
              view === "policies" ? "Show policy connectors" : "Show policies"
            }
            onClick={() =>
              setView((current) =>
                current === "policies" ? "connectors" : "policies",
              )
            }
          >
            {view === "policies" ? "Connectors" : "Policies"}
          </Button>
        </div>
        <div className="env-grid-shell" style={{ flex: 1, minHeight: 0 }}>
          {view === "policies" ? (
            <AgGridReact<PolicyCompareRow>
              theme={theme}
              rowData={visibleCompareRows}
              getRowId={getPolicyRowId}
              columnDefs={policyGridColumnDefs}
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
          ) : (
            <ConnectorsGrid
              theme={theme}
              groups={groups}
              connectors={connectors}
              secondaryConnectors={secondaryConnectors}
              showOnlyDifferences={showOnlyDifferences}
            />
          )}
        </div>
      </div>
    );
  },
);
