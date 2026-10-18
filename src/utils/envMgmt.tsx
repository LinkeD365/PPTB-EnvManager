import envGroupRulesFallback from "../data/EnvGrpRules.json";
import { assertCompleteListResponse } from "./pagedResponse.mjs";

const API_VERSION = "2024-10-01";

export interface EnvGroupRuleRow {
  ruleType: string;
  resourceType: string;
  type: string;
  ruleId: string;
  groupId: string;
  dataType: string;
  value: EnvGroupValueObject;
  shortDescription: string;
  longDescription: string;
  policyInputKey?: string;
  policyValuePath?: string;
  policyEditor?: "knowledgeSourceUrls";
  parentRuleId?: string;
  childValueWhenDisabled?: unknown;
  childEnabledValue?: unknown;
  currentValueString: string;
  newValueString: string;
  edit: boolean;
  dependencyUpdate?: boolean;
  editable: boolean;
  isNew?: boolean;
  updateContext?: EnvGroupRuleUpdateContext;
}

export interface EnvGroupPolicyConnectorRow {
  rowKey: string;
  environmentGroupId: string;
  policyId: string;
  policyName: string;
  ruleSetId: string;
  connectorName: string;
  connectorPath: string;
}

export interface EnvGroupRulesResult {
  rules: EnvGroupRuleRow[];
  connectors: EnvGroupPolicyConnectorRow[];
}

export interface EnvGroupRuleSetUpdateContext {
  kind: "ruleSet";
  ruleSetId: string;
  ruleSet: Record<string, unknown>;
  parameterType: string;
  resourceType: string;
  propertyName: string;
}

export interface EnvGroupPolicyUpdateContext {
  kind: "policy";
  policyId: string;
  policy: Record<string, unknown>;
  ruleSetIndex: number;
  inputKey: string;
  currentValue: unknown;
}

export type EnvGroupRuleUpdateContext =
  | EnvGroupRuleSetUpdateContext
  | EnvGroupPolicyUpdateContext;

export interface EnvGroupValueObject {
  id: string;
  value: string;
  choices: EnvGroupChoice[];
  min?: number;
  max?: number;
  allowNoLimit?: boolean;
}

function getNestedValue(value: unknown, path?: string): unknown {
  return path
    ?.split(".")
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[key]
          : undefined,
      value,
    );
}

export interface EnvGroupChoice {
  value: string | number;
  label: string;
  visible?: boolean;
  default?: boolean;
}

export class EnvMgmt {
  private getPolicyConnectors(
    currentPolicies: unknown,
    environmentGroupId: string,
  ): EnvGroupPolicyConnectorRow[] {
    if (!currentPolicies || typeof currentPolicies !== "object") {
      return [];
    }

    const policy = currentPolicies as Record<string, unknown>;
    const policyId = String(policy.id ?? policy.policyId ?? "").trim();
    const policyName = String(
      policy.displayName ?? policy.name ?? policyId,
    ).trim();
    const connectors = new Map<string, EnvGroupPolicyConnectorRow>();

    for (const ruleSet of Array.isArray(policy.ruleSets)
      ? policy.ruleSets
      : []) {
      if (!ruleSet || typeof ruleSet !== "object") {
        continue;
      }

      const ruleSetRecord = ruleSet as Record<string, unknown>;
      const ruleSetId = String(
        ruleSetRecord.id ?? ruleSetRecord.ruleSetId ?? "",
      ).trim();
      const inputs =
        ruleSetRecord.inputs && typeof ruleSetRecord.inputs === "object"
          ? (ruleSetRecord.inputs as Record<string, unknown>)
          : {};

      for (const entry of Array.isArray(inputs.AllowedConnectorList)
        ? inputs.AllowedConnectorList
        : []) {
        if (!entry || typeof entry !== "object") {
          continue;
        }

        const connector = entry as Record<string, unknown>;
        const connectorPath = String(
          connector.AllowedConnector ?? connector.allowedConnector ?? "",
        ).trim();
        if (!connectorPath) {
          continue;
        }

        const connectorName =
          connectorPath.split("/").filter(Boolean).pop() ?? connectorPath;
        const rowKey =
          `${environmentGroupId}::${policyId}::${ruleSetId}::${connectorPath}`.toLowerCase();
        connectors.set(rowKey, {
          rowKey,
          environmentGroupId,
          policyId,
          policyName,
          ruleSetId,
          connectorName,
          connectorPath,
        });
      }
    }

    return Array.from(connectors.values());
  }

  async getEnvironmentGroupRuleSets(
    environmentGroupId: string,
    target?: PowerPlatformAPI.ConnectionTarget,
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const endpoint = `environmentGroups/${environmentGroupId}/ruleSets?api-version=${API_VERSION}`;
    const response = await window.powerplatformAPI.Governance.Get(
      endpoint,
      target,
    );
    assertCompleteListResponse(response, "environment group rule sets");
    return response;
  }

  async getRuleBasedPolicies(
    environmentGroupId: string,
    target?: PowerPlatformAPI.ConnectionTarget,
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const assignedPolicy = `ruleBasedPolicies/environmentGroups/${environmentGroupId}/assignments?api-version=${API_VERSION}`;
    const response = await window.powerplatformAPI.Governance.Get(
      assignedPolicy,
      target,
    );
    assertCompleteListResponse(response, "environment group policy assignments");
    const policyId = String(
      (response as { value?: Array<{ policyId?: unknown }> }).value?.[0]
        ?.policyId ?? "",
    ).trim();

    if (!policyId) {
      return { value: [] };
    }

    const policyDetailsResponse = await window.powerplatformAPI.Governance.Get(
      `ruleBasedPolicies/${policyId}?api-version=${API_VERSION}`,
      target,
    );
    return policyDetailsResponse;
  }

  async getEnvGroupRules(
    envGroupId: string,
    target: PowerPlatformAPI.ConnectionTarget,
  ): Promise<EnvGroupRulesResult> {
    const [currentRuleSets, allRules, currentPolicies] = await Promise.all([
      this.getEnvironmentGroupRuleSets(envGroupId, target),
      this.getEnvGrpFullSet(),
      this.getRuleBasedPolicies(envGroupId, target),
    ]);

    if (!currentRuleSets || typeof currentRuleSets !== "object") {
      throw new Error("Invalid response from getEnvironmentGroupRuleSets");
    }

    const { currentValuesByKey, updateContextsByKey, firstRuleSet } =
      this.convertCurrentRuleSets(currentRuleSets);
    const policyWithCatalogRuleSets = this.addMissingPolicyRuleSets(
      currentPolicies,
      allRules,
    );
    const {
      currentPolicyValuesByKey,
      policyUpdateContextsByKey,
      policyRuleSetContextsByGroup,
    } = this.convertCurrentPolicies(policyWithCatalogRuleSets);

    const rules = (Array.isArray(allRules) ? allRules : []).map((rule) => {
      if (!rule || typeof rule !== "object") {
        return rule;
      }

      const nextRule = { ...rule } as EnvGroupRuleRow & Record<string, unknown>;
      const type = String(nextRule.type ?? "").trim();
      const resourceType = String(
        nextRule.resourceType ?? "NotSpecified",
      ).trim();
      const ruleId = String(
        nextRule.ruleId ?? nextRule.groupId ?? nextRule.value?.id ?? "",
      ).trim();
      const propertyId = String(nextRule.value?.id ?? ruleId).trim();
      const key = `${type}::${resourceType}::${propertyId}`.toLowerCase();
      const policyInputKey = String(nextRule.policyInputKey ?? ruleId);
      const policyKey = `${nextRule.groupId}::${policyInputKey}`.toLowerCase();
      const policyContext =
        nextRule.ruleType === "policy"
          ? (policyUpdateContextsByKey.get(policyKey) ??
            (() => {
              const ruleSetContext = policyRuleSetContextsByGroup.get(
                String(nextRule.groupId).toLowerCase(),
              );
              return ruleSetContext
                ? {
                    ...ruleSetContext,
                    inputKey: policyInputKey,
                    currentValue: undefined,
                  }
                : undefined;
            })())
          : undefined;
      const nestedPolicyValue = getNestedValue(
        policyContext?.currentValue,
        nextRule.policyValuePath,
      );
      const policyValueExists = nextRule.policyValuePath
        ? nestedPolicyValue !== undefined
        : policyContext?.currentValue &&
            typeof policyContext.currentValue === "object" &&
            !Array.isArray(policyContext.currentValue) &&
            nextRule.value?.id
          ? Object.prototype.hasOwnProperty.call(
              policyContext.currentValue,
              nextRule.value.id,
            )
          : policyContext?.currentValue !== undefined;
      const currentValueString = nextRule.policyValuePath
        ? nestedPolicyValue !== null && typeof nestedPolicyValue === "object"
          ? JSON.stringify(nestedPolicyValue)
          : String(nestedPolicyValue ?? "")
        : policyContext?.currentValue &&
            typeof policyContext.currentValue === "object" &&
            !Array.isArray(policyContext.currentValue) &&
            nextRule.value?.id
          ? String(
              (policyContext.currentValue as Record<string, unknown>)[
                nextRule.value.id
              ] ?? "",
            )
          : nextRule.ruleType === "policy"
            ? (currentPolicyValuesByKey.get(policyKey) ?? "")
            : (currentValuesByKey.get(key) ?? "");
      const firstRuleSetId = String(firstRuleSet?.id ?? "").trim();
      const updateContext =
        nextRule.ruleType === "policy"
          ? policyContext
          : (updateContextsByKey.get(key) ??
            (firstRuleSet && firstRuleSetId && type && ruleId
              ? {
                  kind: "ruleSet" as const,
                  ruleSetId: firstRuleSetId,
                  ruleSet: firstRuleSet,
                  parameterType: type,
                  resourceType,
                  propertyName: propertyId,
                }
              : undefined));

      nextRule.currentValueString = currentValueString;
      nextRule.newValueString = currentValueString;
      nextRule.longDescription = String(
        nextRule.LongDescription ??
          nextRule.longDescription ??
          nextRule.longDecscription ??
          "",
      );
      nextRule.edit = false;
      nextRule.editable = Boolean(updateContext);
      nextRule.isNew =
        nextRule.ruleType === "policy"
          ? !policyValueExists
          : !currentValuesByKey.has(key);
      nextRule.updateContext = updateContext;
      return nextRule;
    }) as EnvGroupRuleRow[];

    return {
      rules,
      connectors: this.getPolicyConnectors(currentPolicies, envGroupId),
    };
  }

  private addMissingPolicyRuleSets(
    currentPolicies: unknown,
    allRules: EnvGroupRuleRow[],
  ): unknown {
    if (!currentPolicies || typeof currentPolicies !== "object") {
      return currentPolicies;
    }

    const policy = currentPolicies as Record<string, unknown>;
    if (!String(policy.id ?? "").trim()) {
      return currentPolicies;
    }

    const clone = JSON.parse(JSON.stringify(policy)) as Record<string, unknown>;
    const ruleSets = Array.isArray(clone.ruleSets)
      ? (clone.ruleSets as Record<string, unknown>[])
      : [];
    clone.ruleSets = ruleSets;
    const existingGroupIds = new Set(
      ruleSets.map((ruleSet) => String(ruleSet.id ?? "").toLowerCase()),
    );

    for (const rule of allRules) {
      const groupId = String(rule?.groupId ?? "").trim();
      if (
        rule?.ruleType !== "policy" ||
        !groupId ||
        existingGroupIds.has(groupId.toLowerCase())
      ) {
        continue;
      }

      ruleSets.push({ id: groupId, inputs: {} });
      existingGroupIds.add(groupId.toLowerCase());
    }

    return clone;
  }

  private convertCurrentRuleSets(currentRuleSets: object): {
    currentValuesByKey: Map<string, string>;
    updateContextsByKey: Map<string, EnvGroupRuleUpdateContext>;
    firstRuleSet?: Record<string, unknown>;
  } {
    const response = currentRuleSets as Record<string, unknown>;
    const payload = Array.isArray(response.value)
      ? response.value
      : Array.isArray(response.payload)
        ? response.payload
        : [];
    const currentValuesByKey = new Map<string, string>();
    const updateContextsByKey = new Map<string, EnvGroupRuleUpdateContext>();
    const firstRuleSet = payload.find(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry && typeof entry === "object"),
    );

    for (const entry of payload) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const ruleSet = entry as Record<string, unknown>;
      const ruleSetId = String(ruleSet.id ?? "").trim();

      for (const parameter of Array.isArray(ruleSet.parameters)
        ? ruleSet.parameters
        : []) {
        if (!parameter || typeof parameter !== "object") {
          continue;
        }

        const parameterRecord = parameter as Record<string, unknown>;
        const parameterType = String(parameterRecord.type ?? "").trim();
        const resourceType = String(
          parameterRecord.resourceType ?? "NotSpecified",
        ).trim();

        for (const valueEntry of Array.isArray(parameterRecord.value)
          ? parameterRecord.value
          : []) {
          if (!valueEntry || typeof valueEntry !== "object") {
            continue;
          }

          const valueRecord = valueEntry as Record<string, unknown>;
          const propertyId = String(
            valueRecord.id ?? valueRecord.name ?? "",
          ).trim();

          if (!parameterType || !propertyId) {
            continue;
          }

          const key =
            `${parameterType}::${resourceType}::${propertyId}`.toLowerCase();
          currentValuesByKey.set(key, String(valueRecord.value ?? ""));

          if (ruleSetId) {
            updateContextsByKey.set(key, {
              kind: "ruleSet",
              ruleSetId,
              ruleSet,
              parameterType,
              resourceType,
              propertyName: propertyId,
            });
          }
        }
      }
    }

    return { currentValuesByKey, updateContextsByKey, firstRuleSet };
  }

  private convertCurrentPolicies(currentPolicies: unknown): {
    currentPolicyValuesByKey: Map<string, string>;
    policyUpdateContextsByKey: Map<string, EnvGroupPolicyUpdateContext>;
    policyRuleSetContextsByGroup: Map<string, EnvGroupPolicyUpdateContext>;
  } {
    const currentValuesByKey = new Map<string, string>();
    const updateContextsByKey = new Map<string, EnvGroupPolicyUpdateContext>();
    const ruleSetContextsByGroup = new Map<
      string,
      EnvGroupPolicyUpdateContext
    >();

    if (!currentPolicies || typeof currentPolicies !== "object") {
      return {
        currentPolicyValuesByKey: currentValuesByKey,
        policyUpdateContextsByKey: updateContextsByKey,
        policyRuleSetContextsByGroup: ruleSetContextsByGroup,
      };
    }

    const policy = currentPolicies as Record<string, unknown>;
    const policyId = String(policy.id ?? "").trim();

    for (const [ruleSetIndex, ruleSet] of (Array.isArray(policy.ruleSets)
      ? policy.ruleSets
      : []
    ).entries()) {
      if (!ruleSet || typeof ruleSet !== "object") {
        continue;
      }

      const record = ruleSet as Record<string, unknown>;
      const groupId = String(record.id ?? "").trim();

      if (!groupId) {
        continue;
      }

      if (policyId) {
        ruleSetContextsByGroup.set(groupId.toLowerCase(), {
          kind: "policy",
          policyId,
          policy,
          ruleSetIndex,
          inputKey: "",
          currentValue: undefined,
        });
      }

      if (!record.inputs || typeof record.inputs !== "object") {
        continue;
      }

      for (const [ruleId, value] of Object.entries(
        record.inputs as Record<string, unknown>,
      )) {
        const key = `${groupId}::${ruleId}`.toLowerCase();
        currentValuesByKey.set(
          key,
          value !== null && typeof value === "object"
            ? JSON.stringify(value)
            : String(value ?? ""),
        );
        if (policyId) {
          updateContextsByKey.set(key, {
            kind: "policy",
            policyId,
            policy,
            ruleSetIndex,
            inputKey: ruleId,
            currentValue: value,
          });
        }
      }
    }

    return {
      currentPolicyValuesByKey: currentValuesByKey,
      policyUpdateContextsByKey: updateContextsByKey,
      policyRuleSetContextsByGroup: ruleSetContextsByGroup,
    };
  }

  private async getEnvGrpFullSet(): Promise<EnvGroupRuleRow[]> {
    const entries: unknown = envGroupRulesFallback;
    if (!Array.isArray(entries)) {
      return [];
    }

    return entries.flatMap((entry): EnvGroupRuleRow[] => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const source = entry as Record<string, unknown>;
      const sourceValue =
        source.value && typeof source.value === "object"
          ? (source.value as Record<string, unknown>)
          : {};
      const choices = Array.isArray(sourceValue.choices)
        ? sourceValue.choices.flatMap((choice): EnvGroupChoice[] => {
            if (!choice || typeof choice !== "object") {
              return [];
            }
            const option = choice as Record<string, unknown>;
            const value = option.value;
            if (
              (typeof value !== "string" && typeof value !== "number") ||
              typeof option.label !== "string"
            ) {
              return [];
            }
            return [{
              value,
              label: option.label,
              visible:
                typeof option.visible === "boolean"
                  ? option.visible
                  : undefined,
              default:
                typeof option.default === "boolean"
                  ? option.default
                  : undefined,
            }];
          })
        : [];
      const text = (key: string, fallback = ""): string =>
        typeof source[key] === "string" ? (source[key] as string) : fallback;

      return [{
        ruleType: text("ruleType", "ruleSet"),
        resourceType: text("resourceType", "NotSpecified"),
        type: text("type"),
        ruleId:
          text("ruleId", text("groupId")) ||
          (typeof sourceValue.id === "string" ? sourceValue.id : ""),
        groupId: text("groupId"),
        dataType: text("dataType", "text"),
        value: {
          id: typeof sourceValue.id === "string" ? sourceValue.id : "",
          value:
            typeof sourceValue.value === "string" ? sourceValue.value : "",
          choices,
          min: typeof sourceValue.min === "number" ? sourceValue.min : undefined,
          max: typeof sourceValue.max === "number" ? sourceValue.max : undefined,
          allowNoLimit:
            typeof sourceValue.allowNoLimit === "boolean"
              ? sourceValue.allowNoLimit
              : undefined,
        },
        shortDescription: text("shortDescription"),
        longDescription: text("longDescription", text("longDecscription")),
        policyInputKey: text("policyInputKey") || undefined,
        policyValuePath: text("policyValuePath") || undefined,
        policyEditor:
          source.policyEditor === "knowledgeSourceUrls"
            ? "knowledgeSourceUrls"
            : undefined,
        parentRuleId: text("parentRuleId") || undefined,
        childValueWhenDisabled: source.childValueWhenDisabled,
        childEnabledValue: source.childEnabledValue,
        currentValueString: "",
        newValueString: "",
        edit: false,
        editable: false,
        isNew: false,
      }];
    });
  }
}
