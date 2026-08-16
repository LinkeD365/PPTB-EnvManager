import React from "react";
import {
  AgGridReact,
  CustomCellRendererProps,
  CustomInnerHeaderProps,
} from "ag-grid-react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Select,
  Switch,
} from "@fluentui/react-components";
import {
  AddRegular,
  ArrowLeft16Regular,
  ArrowUndoRegular,
  DeleteRegular,
  EditRegular,
  Save20Filled,
} from "@fluentui/react-icons";
import {
  CellStyleModule,
  ColDef,
  GetRowIdParams,
  ModuleRegistry,
  RenderApiModule,
  RowAutoHeightModule,
  RowSelectionModule,
  Theme,
  ValidationModule,
} from "ag-grid-community";
import { EnvironmentGroupRow } from "./EnvironmentGroupsList";
import { EnvGroupRuleRow, EnvMgmt } from "../utils/envMgmt";
import { environmentManagement } from "../utils/environmentManagement";
import { RuleSetInfoPopup } from "./Info";

ModuleRegistry.registerModules([
  RowAutoHeightModule,
  ValidationModule,
  CellStyleModule,
  RenderApiModule,
  RowSelectionModule,
]);

interface PoliciesGridv2Props {
  groups: EnvironmentGroupRow[];
  theme?: Theme | "legacy";
  onBack: () => void;
}

function getPolicyRowId(params: GetRowIdParams<EnvGroupRuleRow>): string {
  return params.data.ruleType === "policy"
    ? `policy::${params.data.groupId}::${params.data.ruleId}`.toLowerCase()
    : `ruleSet::${params.data.type}::${params.data.resourceType}::${params.data.ruleId}`.toLowerCase();
}

function isDependencyLocked(
  rule: EnvGroupRuleRow,
  rules: EnvGroupRuleRow[],
): boolean {
  if (!rule.parentRuleId) {
    return false;
  }

  const parent = rules.find(
    (candidate) =>
      candidate.groupId.toLowerCase() === rule.groupId.toLowerCase() &&
      candidate.ruleId.toLowerCase() === rule.parentRuleId!.toLowerCase(),
  );

  return Boolean(
    parent &&
    parent.childEnabledValue !== undefined &&
    String(parent.newValueString ?? parent.currentValueString)
      .trim()
      .toLowerCase() !== String(parent.childEnabledValue).trim().toLowerCase(),
  );
}

function applyDependencyUpdates(rules: EnvGroupRuleRow[]): EnvGroupRuleRow[] {
  return rules.map((rule) => {
    if (!rule.parentRuleId) {
      return rule;
    }

    const parent = rules.find(
      (candidate) =>
        candidate.groupId.toLowerCase() === rule.groupId.toLowerCase() &&
        candidate.ruleId.toLowerCase() === rule.parentRuleId!.toLowerCase(),
    );

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

function getRuleValueLabel(rule: EnvGroupRuleRow, value: string): string {
  if (rule.dataType === "number" && rule.value?.allowNoLimit && value === "-1") {
    return "No limit";
  }

  if (rule.policyEditor === "knowledgeSourceUrls") {
    try {
      const rules = JSON.parse(value) as Array<{
        url?: string;
        behavior?: string;
      }>;
      return rules.length === 1 && rules[0]?.url === "*"
        ? rules[0].behavior === "Allow"
          ? "All"
          : "None"
        : "Custom";
    } catch {
      return value;
    }
  }

  return rule.dataType === "choice"
    ? (rule.value?.choices?.find((choice) => String(choice.value) === value)
        ?.label ?? value)
    : value;
}

type KnowledgeSourceUrlRule = {
  url: string;
  order: number;
  behavior: "Allow" | "Deny";
};

function parseKnowledgeSourceRules(value: string): KnowledgeSourceUrlRule[] {
  try {
    return (JSON.parse(value) as unknown[]).map((rule, index) => ({
      url: String((rule as Record<string, unknown>).url ?? ""),
      order: index + 1,
      behavior:
        (rule as Record<string, unknown>).behavior === "Deny"
          ? "Deny"
          : "Allow",
    }));
  } catch {
    return [];
  }
}

function renderRuleValue(
  rule: EnvGroupRuleRow,
  value: string,
): React.ReactNode {
  if (rule.policyEditor !== "knowledgeSourceUrls") {
    return getRuleValueLabel(rule, value);
  }

  const rules = parseKnowledgeSourceRules(value);
  if (rules.length === 1 && rules[0].url === "*") {
    return rules[0].behavior === "Allow" ? "All" : "None";
  }

  const summary = [
    ...rules
      .slice(0, -1)
      .map((urlRule) => `${urlRule.url} (${urlRule.behavior})`),
    ...(rules.length > 0
      ? [`Default (${rules[rules.length - 1].behavior})`]
      : []),
  ].join(", ");

  return (
    <div
      title={summary}
      style={{
        width: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {summary}
    </div>
  );
}

function canonicalizeKnowledgeSourceRules(
  value: string,
): KnowledgeSourceUrlRule[] {
  const rules = parseKnowledgeSourceRules(value);

  if (
    rules.length === 0 ||
    rules[rules.length - 1].url !== "*" ||
    rules.slice(0, -1).some((rule) => !rule.url.trim() || rule.url === "*")
  ) {
    throw new Error(
      "Custom knowledge source rules require URLs followed by a default rule.",
    );
  }

  return rules.map((rule, index) => ({ ...rule, order: index + 1 }));
}

function KnowledgeSourceEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  const rules = parseKnowledgeSourceRules(value);
  const mode =
    rules.length === 1 && rules[0].url === "*"
      ? rules[0].behavior === "Allow"
        ? "all"
        : "none"
      : "custom";
  const customRules = rules.slice(0, -1);
  const defaultBehavior = rules[rules.length - 1]?.behavior ?? "Deny";
  const updateCustomRules = (
    nextRules: KnowledgeSourceUrlRule[],
    nextDefaultBehavior = defaultBehavior,
  ) =>
    onChange(
      JSON.stringify(
        [
          ...nextRules,
          { url: "*", behavior: nextDefaultBehavior, order: 0 },
        ].map((rule, index) => ({ ...rule, order: index + 1 })),
      ),
    );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
        padding: "4px 0",
      }}
    >
      <Select
        value={mode}
        onChange={(_, data) => {
          if (data.value === "all" || data.value === "none") {
            onChange(
              JSON.stringify([
                {
                  url: "*",
                  order: 1,
                  behavior: data.value === "all" ? "Allow" : "Deny",
                },
              ]),
            );
          } else if (mode !== "custom") {
            updateCustomRules([{ url: "", order: 1, behavior: "Allow" }]);
          }
        }}
      >
        <option value="none">None</option>
        <option value="all">All</option>
        <option value="custom">Custom</option>
      </Select>
      {mode === "custom" && (
        <>
          {customRules.map((urlRule, index) => (
            <div
              key={index}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(120px, 1fr) 100px 32px",
                gap: 6,
                alignItems: "center",
              }}
            >
              <Input
                value={urlRule.url}
                aria-label={`Knowledge source URL ${index + 1}`}
                onChange={(_, data) =>
                  updateCustomRules(
                    customRules.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, url: data.value } : item,
                    ),
                  )
                }
              />
              <Select
                value={urlRule.behavior}
                aria-label={`Behavior for URL ${index + 1}`}
                onChange={(_, data) =>
                  updateCustomRules(
                    customRules.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, behavior: data.value as "Allow" | "Deny" }
                        : item,
                    ),
                  )
                }
              >
                <option value="Allow">Allow</option>
                <option value="Deny">Deny</option>
              </Select>
              <Button
                icon={<DeleteRegular />}
                aria-label={`Remove URL ${index + 1}`}
                disabled={customRules.length === 1}
                onClick={() =>
                  updateCustomRules(
                    customRules.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              />
            </div>
          ))}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Button
              icon={<AddRegular />}
              onClick={() =>
                updateCustomRules([
                  ...customRules,
                  { url: "", order: customRules.length + 1, behavior: "Allow" },
                ])
              }
            >
              Add URL
            </Button>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Default</span>
              <Select
                value={defaultBehavior}
                aria-label="Default knowledge source behavior"
                onChange={(_, data) =>
                  updateCustomRules(customRules, data.value as "Allow" | "Deny")
                }
              >
                <option value="Allow">Allow</option>
                <option value="Deny">Deny</option>
              </Select>
            </div>
          </div>
        </>
      )}
    </div>
  );
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
          ? canonicalizeKnowledgeSourceRules(row.newValueString)
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
  } else {
    inputs[context.inputKey] = coerceRuleValue(row);
  }

  return clone;
}

export const PoliciesGridv2 = React.memo(
  ({
    groups,
    theme = "legacy",
    onBack,
  }: PoliciesGridv2Props): React.JSX.Element => {
    const [loadedRules, setLoadedRules] = React.useState<
      EnvGroupRuleRow[] | null
    >(null);
    const [saving, setSaving] = React.useState(false);
    const [knowledgeEditor, setKnowledgeEditor] = React.useState<{
      rule: EnvGroupRuleRow;
      value: string;
    } | null>(null);

    const openKnowledgeEditor = React.useCallback(
      (rule: EnvGroupRuleRow) =>
        setKnowledgeEditor({ rule, value: rule.newValueString }),
      [],
    );

    const applyKnowledgeEditor = React.useCallback(() => {
      if (!knowledgeEditor) {
        return;
      }

      try {
        const value = JSON.stringify(
          canonicalizeKnowledgeSourceRules(knowledgeEditor.value),
        );
        setLoadedRules(
          (rows) =>
            rows?.map((row) =>
              row.groupId === knowledgeEditor.rule.groupId &&
              row.ruleId === knowledgeEditor.rule.ruleId
                ? {
                    ...row,
                    edit: value !== row.currentValueString,
                    newValueString: value,
                  }
                : row,
            ) ?? null,
        );
        setKnowledgeEditor(null);
      } catch (error) {
        window.toolboxAPI.utils.showNotification({
          title: "Invalid knowledge source rules",
          body: String(error),
          type: "error",
          duration: 4000,
        });
      }
    }, [knowledgeEditor]);

    const setRowEdit = React.useCallback(
      (rule: EnvGroupRuleRow, edit: boolean) => {
        setLoadedRules((rows) => {
          const updatedRows =
            rows?.map((row) =>
              row === rule
                ? {
                    ...row,
                    edit,
                    newValueString:
                      edit &&
                      row.dataType === "number" &&
                      row.value?.allowNoLimit &&
                      row.currentValueString !== "-1" &&
                      (Number(row.currentValueString) < (row.value.min ?? 1) ||
                        Number(row.currentValueString) > (row.value.max ?? 99))
                        ? String(row.value.min ?? 1)
                        : row.currentValueString,
                  }
                : row,
            ) ?? null;

          return !edit && updatedRows
            ? updatedRows.map((row) =>
                row.dependencyUpdate &&
                row.parentRuleId?.toLowerCase() === rule.ruleId.toLowerCase() &&
                row.groupId.toLowerCase() === rule.groupId.toLowerCase()
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
      [],
    );

    const setNewValue = React.useCallback(
      (rule: EnvGroupRuleRow, value: string) => {
        setLoadedRules((rows) => {
          const updatedRows =
            rows?.map((row) =>
              row === rule ? { ...row, newValueString: value } : row,
            ) ?? null;

          return updatedRows ? applyDependencyUpdates(updatedRows) : null;
        });
      },
      [],
    );

    const saveChanges = React.useCallback(async () => {
      const changedRows = (loadedRules ?? []).filter(
        (row) =>
          row.edit &&
          row.updateContext &&
          (row.dependencyUpdate ||
            !isDependencyLocked(row, loadedRules ?? [])) &&
          row.newValueString !== row.currentValueString,
      );

      if (changedRows.length === 0) {
        console.log("[PoliciesGridv2] save skipped: no changed editable rows");
        return;
      }

      const saveStartedAt = Date.now();
      console.log("[PoliciesGridv2] starting policy save", {
        environmentGroupId: groups[0]?.environmentGroupId,
        changedRows: changedRows.map((row) => ({
          ruleId: row.ruleId,
          groupId: row.groupId,
          updateKind: row.updateContext?.kind,
        })),
      });
      setSaving(true);
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

        console.log("[PoliciesGridv2] grouped policy save operations", {
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
          console.log("[PoliciesGridv2] sending rule set update", {
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
          console.log("[PoliciesGridv2] rule set update response", {
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
          console.log("[PoliciesGridv2] sending rule-based policy update", {
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
          console.log("[PoliciesGridv2] rule-based policy update response", {
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

        console.log("[PoliciesGridv2] policy save completed", {
          environmentGroupId: groups[0]?.environmentGroupId,
          durationMs: Date.now() - saveStartedAt,
          changedRowCount: changedRows.length,
          ruleSetUpdateCount: updates.size,
          ruleBasedPolicyUpdateCount: policyUpdates.size,
        });

        const changed = new Set(changedRows);
        setLoadedRules(
          (rows) =>
            rows?.map((row) =>
              changed.has(row)
                ? {
                    ...row,
                    currentValueString: row.newValueString,
                    edit: false,
                    dependencyUpdate: false,
                  }
                : row,
            ) ?? null,
        );
        window.toolboxAPI.utils.showNotification({
          title: "Policy changes saved",
          body: `Saved ${changedRows.length} policy value(s).`,
          type: "success",
          duration: 3000,
        });
      } catch (error) {
        console.error("[PoliciesGridv2] policy save failed", {
          environmentGroupId: groups[0]?.environmentGroupId,
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
        setSaving(false);
      }
    }, [groups, loadedRules]);

    const renderNewValue = React.useCallback(
      (rule: EnvGroupRuleRow) => {
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
                onClick={() => openKnowledgeEditor(rule)}
              />
            </div>
          ) : (
            getRuleValueLabel(rule, rule.newValueString)
          );
        }

        if (!rule.edit || isDependencyLocked(rule, loadedRules ?? [])) {
          return getRuleValueLabel(rule, rule.newValueString);
        }

        if (rule.dataType === "boolean") {
          const checked = rule.newValueString.toLowerCase() === "true";
          return (
            <Switch
              checked={checked}
              label={checked ? "Enabled" : "Disabled"}
              onChange={(_, data) =>
                setNewValue(rule, data.checked ? "true" : "false")
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
                    setNewValue(rule, data.value);
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
              onChange={(_, data) => setNewValue(rule, data.value)}
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
            onChange={(_, data) => setNewValue(rule, data.value)}
          />
        );
      },
      [loadedRules, openKnowledgeEditor, setNewValue],
    );

    const saveHeader = React.useCallback(
      (params: CustomInnerHeaderProps<EnvGroupRuleRow>) => {
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

    const policyGridColumnDefs = React.useMemo<ColDef<EnvGroupRuleRow>[]>(
      () => [
        {
          colId: "Edit",
          headerName: "",
          width: 64,
          minWidth: 64,
          maxWidth: 64,
          sortable: false,
          filter: false,
          resizable: false,
          cellRenderer: (params: CustomCellRendererProps<EnvGroupRuleRow>) => {
            const rule = params.data;
            if (
              !rule?.editable ||
              isDependencyLocked(rule, loadedRules ?? [])
            ) {
              return null;
            }
            return rule.edit ? (
              <Button
                icon={<ArrowUndoRegular />}
                aria-label={`Cancel editing ${rule.shortDescription}`}
                onClick={() => setRowEdit(rule, false)}
              />
            ) : (
              <Button
                icon={<EditRegular />}
                aria-label={`Edit ${rule.shortDescription}`}
                onClick={() =>
                  rule.policyEditor === "knowledgeSourceUrls"
                    ? openKnowledgeEditor(rule)
                    : setRowEdit(rule, true)
                }
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
          filter: false,
          resizable: false,
          cellRenderer: (params: CustomCellRendererProps<EnvGroupRuleRow>) => {
            const rule = params.data;
            if (!rule) {
              return null;
            }

            return (
              <div className="imgCellInfo">
                <RuleSetInfoPopup
                  name={rule.ruleId}
                  description={rule.longDescription}
                />
              </div>
            );
          },
        },
        {
          field: "shortDescription",
          headerName: "Name",
          flex: 2,
          minWidth: 220,
        },
        {
          field: "currentValueString",
          headerName: "Current Value",
          flex: 1,
          minWidth: 160,
          cellRenderer: (params: CustomCellRendererProps<EnvGroupRuleRow>) =>
            params.data
              ? renderRuleValue(params.data, params.data.currentValueString)
              : null,
        },
        {
          field: "newValueString",
          headerName: "New Value",
          headerComponent: saveHeader,
          flex: 1,
          minWidth: 160,
          cellRenderer: (params: CustomCellRendererProps<EnvGroupRuleRow>) =>
            params.data ? renderNewValue(params.data) : null,
        },
      ],
      [
        loadedRules,
        openKnowledgeEditor,
        renderNewValue,
        saveHeader,
        setRowEdit,
      ],
    );

    React.useEffect(() => {
      let cancelled = false;
      const loadPolicies = async () => {
        if (!groups[0]) {
          setLoadedRules([]);
          return;
        }
        const loadedRules = await new EnvMgmt().getEnvGroupRules(
          groups[0].environmentGroupId,
          "primary",
        );
        if (!cancelled) {
          setLoadedRules(loadedRules);
        }
      };

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
        <Dialog
          open={Boolean(knowledgeEditor)}
          onOpenChange={(_, data) => {
            if (!data.open) {
              setKnowledgeEditor(null);
            }
          }}
        >
          <DialogSurface
            style={{ width: "min(760px, calc(100vw - 32px))", maxWidth: 760 }}
          >
            <DialogBody>
              <DialogTitle>
                {knowledgeEditor?.rule.shortDescription ??
                  "Knowledge source rules"}
              </DialogTitle>
              <DialogContent>
                {knowledgeEditor && (
                  <KnowledgeSourceEditor
                    value={knowledgeEditor.value}
                    onChange={(value) =>
                      setKnowledgeEditor({ ...knowledgeEditor, value })
                    }
                  />
                )}
              </DialogContent>
              <DialogActions>
                <Button
                  appearance="secondary"
                  onClick={() => setKnowledgeEditor(null)}
                >
                  Cancel
                </Button>
                <Button appearance="primary" onClick={applyKnowledgeEditor}>
                  Apply
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
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
              {groups[0]?.displayName ?? "Environment group policies"}
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
                {groups[0].environmentGroupId}
              </div>
            )}
          </div>
        </div>
        <div className="env-grid-shell" style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact<EnvGroupRuleRow>
            theme={theme}
            rowData={loadedRules ?? []}
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
        </div>
      </div>
    );
  },
);
