const API_VERSION = "2024-10-01";
const ENV_GROUP_RULES_URL =
  "https://raw.githubusercontent.com/LinkeD365/PPTB-EnvManager/main/EnvGrpRules.json";
import envGroupRulesFallback from "../data/EnvGrpRules.json";

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
  updateContext?: EnvGroupRuleUpdateContext;
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
}

export class EnvMgmt {
  async getEnvironmentGroupRuleSets(
    environmentGroupId: string,
    target?: "primary" | "secondary",
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const endpoint = `environmentGroups/${environmentGroupId}/ruleSets?api-version=${API_VERSION}`;
    console.log("[EnvMgmt] Fetching environment group rule sets", {
      environmentGroupId,
      endpoint,
    });
    const response = await window.powerplatformAPI.Governance.Get(
      endpoint,
      target,
    );
    console.log("[EnvMgmt] Environment group rule sets response", {
      environmentGroupId,
      endpoint,
      response,
    });
    return response;
  }

  async getRuleBasedPolicies(
    environmentGroupId: string,
    target?: "primary" | "secondary",
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const assignedPolicy = `/ruleBasedPolicies/environmentGroups/${environmentGroupId}/assignments?api-version=${API_VERSION}`;
    console.log("[EnvMgmt] Fetching aligned policies", {
      environmentGroupId,
      assignedPolicy,
    });
    const response = await window.powerplatformAPI.Governance.Get(
      assignedPolicy,
      target,
    );
    const policyId = String(
      (response as { value?: Array<{ policyId?: unknown }> }).value?.[0]
        ?.policyId ?? "",
    ).trim();

    const policyDetailsResponse = await window.powerplatformAPI.Governance.Get(
      `/ruleBasedPolicies/${policyId}?api-version=${API_VERSION}`,
      target,
    );
    console.log("[EnvMgmt] Rule based policies response", {
      environmentGroupId,
      assignedPolicy,
      policyId,
      response,
      policyDetailsResponse,
    });

    return policyDetailsResponse;
  }

  async getEnvGroupRules(
    envGroupId: string,
    target: "primary" | "secondary",
  ): Promise<EnvGroupRuleRow[]> {
    const [currentRuleSets, allRules, currentPolicies] = await Promise.all([
      this.getEnvironmentGroupRuleSets(envGroupId, target),
      this.getEnvGrpFullSet(),
      this.getRuleBasedPolicies(envGroupId, target),
    ]);

    console.log("[EnvMgmt] getEnvGroupRules", allRules);

    if (!currentRuleSets || typeof currentRuleSets !== "object") {
      throw new Error("Invalid response from getEnvironmentGroupRuleSets");
    }

    console.log(
      "[EnvMgmt] getEnvGroupRules currentRuleSets",
      JSON.stringify(currentRuleSets),
    );
    const { currentValuesByKey, updateContextsByKey, firstRuleSet } =
      this.convertCurrentRuleSets(currentRuleSets);
    const { currentPolicyValuesByKey, policyUpdateContextsByKey } =
      this.convertCurrentPolicies(currentPolicies);

    return (Array.isArray(allRules) ? allRules : []).map((rule) => {
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
      const policyContext =
        nextRule.ruleType === "policy"
          ? policyUpdateContextsByKey.get(
              `${nextRule.groupId}::${policyInputKey}`.toLowerCase(),
            )
          : undefined;
      const nestedPolicyValue = getNestedValue(
        policyContext?.currentValue,
        nextRule.policyValuePath,
      );
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
            ? (currentPolicyValuesByKey.get(
                `${nextRule.groupId}::${policyInputKey}`.toLowerCase(),
              ) ?? "")
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
      nextRule.updateContext = updateContext;
      return nextRule;
    }) as EnvGroupRuleRow[];
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
  } {
    const currentValuesByKey = new Map<string, string>();
    const updateContextsByKey = new Map<string, EnvGroupPolicyUpdateContext>();

    if (!currentPolicies || typeof currentPolicies !== "object") {
      return {
        currentPolicyValuesByKey: currentValuesByKey,
        policyUpdateContextsByKey: updateContextsByKey,
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

      if (!groupId || !record.inputs || typeof record.inputs !== "object") {
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
    };
  }

  private async getEnvGrpFullSet(): Promise<EnvGroupRuleRow[]> {
    try {
      const response = await fetch(ENV_GROUP_RULES_URL);
      if (!response.ok) {
        throw new Error("Failed to fetch environment group rules");
      }
      const data = await response.json();
      return data as EnvGroupRuleRow[];
    } catch (error) {
      console.error(
        "Error fetching environment group rules, using fallback",
        error,
      );
      console.log("envGroupRulesFallback: ", envGroupRulesFallback);
      return envGroupRulesFallback as unknown as EnvGroupRuleRow[];
    }
  }
}
