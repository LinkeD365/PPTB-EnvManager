interface EnvironmentApiOptions {
  connectionTarget?: "primary" | "secondary";
}

const API_VERSION = "2024-10-01";

export interface EnvironmentGroupPolicyRule {
  policyId: string;
  policyName: string;
  policyDescription?: string;
  ruleText: string;
}

export interface EnvironmentGroupPolicyRuleSetRow {
  policyId: string;
  policyName: string;
  ruleSetId: string;
  version?: string;
  allowedConnectorNames: string[];
  inputsText: string;
  rowType: "ruleSet" | "connector";
  connectorName?: string;
  rowKey: string;
}

export class EnvironmentManagementUtils {
  private getConnectionTarget(options?: EnvironmentApiOptions): "primary" | "secondary" | undefined {
    return options?.connectionTarget;
  }

  private async get(
    endpoint: string,
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    return window.powerplatformAPI.EnvironmentManagement.Get(endpoint, this.getConnectionTarget(options));
  }

  private async patch(
    endpoint: string,
    body: Record<string, string | number | boolean | null>,
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    return window.powerplatformAPI.EnvironmentManagement.Patch(endpoint, body, this.getConnectionTarget(options));
  }

  async getEnvironmentGroupPolicyAssignments(
    environmentGroupId: string,
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const endpoint = `ruleBasedPolicies/environmentGroups/${environmentGroupId}/assignments?api-version=${API_VERSION}`;
    console.log("[EnvironmentManagementUtils] Fetching environment group policy assignments", {
      environmentGroupId,
      endpoint,
    });
    const response = await window.powerplatformAPI.Governance.Get(endpoint, this.getConnectionTarget(options));
    console.log("[EnvironmentManagementUtils] Environment group policy assignments response", {
      environmentGroupId,
      endpoint,
      response,
    });
    return response;
  }

  async getRuleBasedPolicy(
    policyId: string,
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const endpoint = `ruleBasedPolicies/${policyId}?api-version=${API_VERSION}`;
    const response = await window.powerplatformAPI.Governance.Get(endpoint, this.getConnectionTarget(options));
    console.log("[EnvironmentManagementUtils] Rule-based policy response", {
      policyId,
      endpoint,
      response,
    });
    return response;
  }

  async getEnvironmentGroupRuleSets(
    environmentGroupId: string,
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const endpoint = `environmentGroups/${environmentGroupId}/ruleSets?api-version=${API_VERSION}`;
    console.log("[EnvironmentManagementUtils] Fetching environment group rule sets", {
      environmentGroupId,
      endpoint,
    });
    const response = await window.powerplatformAPI.Governance.Get(endpoint, this.getConnectionTarget(options));
    console.log("[EnvironmentManagementUtils] Environment group rule sets response", {
      environmentGroupId,
      endpoint,
      response,
    });
    return response;
  }

  async getEnvironmentManagementSettings(
    environmentId: string,
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const endpoint = `environments/${environmentId}/settings?$select=*&api-version=${API_VERSION}`;
    return this.get(endpoint, options);
  }

  async updateEnvironmentManagementSettings(
    environmentId: string,
    changes: Record<string, string | number | boolean | null>,
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const endpoint = `environments/${environmentId}/settings?api-version=${API_VERSION}`;
    return this.patch(endpoint, changes, options);
  }

  async getEnvironmentGroups(
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const endpoint = `environmentGroups?api-version=${API_VERSION}`;
    return this.get(endpoint, options);
  }

  async getEnvironments(
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const endpoint = `environments?api-version=${API_VERSION}`;
    return this.get(endpoint, options);
  }

  private normalizePayloadArray(payload: unknown): unknown[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && typeof payload === "object") {
      const record = payload as { value?: unknown; objectResult?: unknown };
      if (Array.isArray(record.value)) {
        return record.value;
      }
      if (Array.isArray(record.objectResult)) {
        return record.objectResult;
      }
      return [payload];
    }

    return [];
  }

  private extractText(value: unknown): string {
    if (typeof value === "string") {
      return value.trim();
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return "";
  }

  private extractPolicyId(entry: Record<string, unknown>): string {
    const nestedPolicy = entry.ruleBasedPolicy;
    if (nestedPolicy && typeof nestedPolicy === "object") {
      const nested = nestedPolicy as Record<string, unknown>;
      const nestedId = this.extractText(nested.ruleBasedPolicyId ?? nested.id ?? nested.policyId ?? nested.name);
      if (nestedId) {
        return nestedId;
      }
    }

    const nestedRuleBasedPolicy = entry.ruleBasedPolicy;
    const nestedRuleBasedPolicyId =
      nestedRuleBasedPolicy && typeof nestedRuleBasedPolicy === "object"
        ? this.extractText((nestedRuleBasedPolicy as Record<string, unknown>).id)
        : "";

    return this.extractText(entry.ruleBasedPolicyId ?? entry.policyId ?? entry.id ?? entry.name) || nestedRuleBasedPolicyId;
  }

  private normalizePolicyRows(policy: unknown): EnvironmentGroupPolicyRuleSetRow[] {
    if (!policy || typeof policy !== "object") {
      return [];
    }

    const record = policy as Record<string, unknown>;
    const policyId = this.extractText(record.ruleBasedPolicyId ?? record.id ?? record.policyId ?? record.name) || "unknown";
    const policyName =
      this.extractText(record.displayName ?? record.name ?? record.title ?? record.policyName ?? record.ruleBasedPolicyName) ||
      policyId;
    const ruleSets = Array.isArray(record.ruleSets) ? record.ruleSets : [];

    if (ruleSets.length === 0) {
      return [
        {
          policyId,
          policyName,
          ruleSetId: "(no rule sets)",
          version: this.extractText(record.version),
          allowedConnectorNames: [],
          inputsText: JSON.stringify(record, null, 2),
          rowType: "ruleSet",
          rowKey: `${policyId}::(no rule sets)`,
        },
      ];
    }

    return ruleSets.flatMap((ruleSet) => {
      const ruleSetRecord = ruleSet && typeof ruleSet === "object" ? (ruleSet as Record<string, unknown>) : {};
      const inputs = ruleSetRecord.inputs && typeof ruleSetRecord.inputs === "object" ? (ruleSetRecord.inputs as Record<string, unknown>) : {};
      const allowedConnectorList = Array.isArray(inputs.AllowedConnectorList) ? inputs.AllowedConnectorList : [];
      const allowedConnectorNames = allowedConnectorList
        .map((connector) => {
          if (!connector || typeof connector !== "object") {
            return "";
          }

          const connectorRecord = connector as Record<string, unknown>;
          const allowedConnector = this.extractText(connectorRecord.AllowedConnector ?? connectorRecord.allowedConnector);
          if (!allowedConnector) {
            return "";
          }

          const parts = allowedConnector.split("/").filter(Boolean);
          return parts[parts.length - 1] ?? allowedConnector;
        })
        .filter((connectorName) => Boolean(connectorName));

      const ruleSetId = this.extractText(ruleSetRecord.id ?? ruleSetRecord.ruleSetId ?? ruleSetRecord.name) || "unknown";
      const isConnectorManagementRuleSet = ruleSetId.toLowerCase() === "connectormanagement";
      const inputEntries = Object.entries(inputs);

      const inputRows: EnvironmentGroupPolicyRuleSetRow[] =
        inputEntries.length === 0
          ? [
              {
                policyId,
                policyName,
                ruleSetId,
                version: this.extractText(ruleSetRecord.version),
                allowedConnectorNames: [],
                inputsText: JSON.stringify(inputs, null, 2),
                rowType: "ruleSet",
                rowKey: `${policyId}::${ruleSetId}`,
              },
            ]
          : inputEntries.map(([inputLabel, inputValue]) => {
              const rowValue =
                isConnectorManagementRuleSet
                  ? ""
                  : this.extractText(inputValue) ||
                    (inputValue !== undefined && inputValue !== null ? JSON.stringify(inputValue) : "");
              const displayRuleSetId = isConnectorManagementRuleSet ? ruleSetId : `${ruleSetId} / ${inputLabel}`;

              return {
                policyId,
                policyName,
                ruleSetId: displayRuleSetId,
                version: this.extractText(ruleSetRecord.version),
                allowedConnectorNames: rowValue ? [rowValue] : [],
                inputsText: JSON.stringify(inputs, null, 2),
                rowType: "ruleSet" as const,
                rowKey: `${policyId}::${ruleSetId}::${inputLabel}`,
              };
            });

      const connectorRows: EnvironmentGroupPolicyRuleSetRow[] =
        isConnectorManagementRuleSet
          ? allowedConnectorNames.map((connectorName) => ({
              policyId,
              policyName,
              ruleSetId: `${ruleSetId} / AllowedConnector`,
              version: this.extractText(ruleSetRecord.version),
              allowedConnectorNames: [connectorName],
              inputsText: "",
              rowType: "connector",
              connectorName,
              rowKey: `${policyId}::${ruleSetId}::${connectorName}`,
            }))
          : [];

      return [...inputRows, ...connectorRows];
    });
  }

  private normalizeEnvironmentGroupRuleSetRows(payload: unknown): EnvironmentGroupPolicyRuleSetRow[] {
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const record = payload as Record<string, unknown>;
    const sourceId = this.extractText(record.id) || "environment-group-rule-set";
    const parameters = Array.isArray(record.parameters) ? record.parameters : [];

    return parameters.flatMap((parameter, parameterIndex) => {
      const parameterRecord = parameter && typeof parameter === "object" ? (parameter as Record<string, unknown>) : {};
      const parameterType = this.extractText(parameterRecord.type) || "RuleSet";
      const isConnectorManagementParameter = parameterType.toLowerCase() === "connectormanagement";
      const parameterValues = Array.isArray(parameterRecord.value) ? parameterRecord.value : [];

      if (parameterValues.length === 0) {
        return [
          {
            policyId: sourceId,
            policyName: parameterType,
            ruleSetId: parameterType,
            version: "",
            allowedConnectorNames: [],
            inputsText: "",
            rowType: "ruleSet",
            rowKey: `${sourceId}::${parameterType}::${parameterIndex}`,
          },
        ];
      }

      return parameterValues.map((parameterValue, valueIndex) => {
        const valueRecord =
          parameterValue && typeof parameterValue === "object" ? (parameterValue as Record<string, unknown>) : {};
        const valueId = this.extractText(valueRecord.id) || `value-${valueIndex + 1}`;
        const rawValue = valueRecord.value;
        const normalizedValue = this.extractText(rawValue) || (rawValue !== undefined ? JSON.stringify(rawValue) : "");

        return {
          policyId: sourceId,
          policyName: parameterType,
          ruleSetId: `${parameterType} / ${valueId}`,
          version: "",
          allowedConnectorNames: isConnectorManagementParameter ? [] : normalizedValue ? [normalizedValue] : [],
          inputsText: "",
          rowType: "ruleSet" as const,
          rowKey: `${sourceId}::${parameterType}::${valueId}::${valueIndex}`,
        };
      });
    });
  }

  async getEnvironmentGroupPolicyRules(
    environmentGroupId: string,
    options?: EnvironmentApiOptions
  ): Promise<EnvironmentGroupPolicyRuleSetRow[]> {
    const [assignmentsResponse, ruleSetsResponse] = await Promise.all([
      this.getEnvironmentGroupPolicyAssignments(environmentGroupId, options),
      this.getEnvironmentGroupRuleSets(environmentGroupId, options),
    ]);

    console.log("[EnvironmentManagementUtils] Environment group policy assignments response", {
      environmentGroupId,
      assignmentsResponse,
    });
    const assignmentRows = this.normalizePayloadArray(assignmentsResponse);
    console.log("[EnvironmentManagementUtils] Environment group rule sets response", {
      environmentGroupId,
      ruleSetsResponse,
    });
    const ruleSetRows = this.normalizePayloadArray(ruleSetsResponse).flatMap((entry) =>
      this.normalizeEnvironmentGroupRuleSetRows(entry)
    );
    const policyIds = Array.from(
      new Set(
        assignmentRows
          .map((entry) => (entry && typeof entry === "object" ? this.extractPolicyId(entry as Record<string, unknown>) : ""))
          .filter((policyId) => Boolean(policyId))
      )
    );

    if (policyIds.length === 0) {
      return [];
    }

    const details = await Promise.all(
      policyIds.map(async (policyId) => {
        const response = await this.getRuleBasedPolicy(policyId, options);
        const normalized = this.normalizePayloadArray(response);
        return this.normalizePolicyRows(normalized[0] ?? response);
      })
    );

    const rowsByKey = new Map<string, EnvironmentGroupPolicyRuleSetRow>();
    for (const row of [...ruleSetRows, ...details.flat()]) {
      rowsByKey.set(row.rowKey, row);
    }

    return Array.from(rowsByKey.values()).sort((left, right) => {
      const policyCompare = left.policyName.localeCompare(right.policyName);
      return policyCompare !== 0 ? policyCompare : left.ruleSetId.localeCompare(right.ruleSetId);
    });
  }
}

export const environmentManagement = new EnvironmentManagementUtils();

export async function getEnvironmentGroupPolicyAssignments(
  environmentGroupId: string,
  options?: EnvironmentApiOptions
): Promise<PowerPlatformAPI.PowerPlatformResponse> {
  return environmentManagement.getEnvironmentGroupPolicyAssignments(environmentGroupId, options);
}

export async function getRuleBasedPolicy(
  policyId: string,
  options?: EnvironmentApiOptions
): Promise<PowerPlatformAPI.PowerPlatformResponse> {
  return environmentManagement.getRuleBasedPolicy(policyId, options);
}

export async function getEnvironmentGroupRuleSets(
  environmentGroupId: string,
  options?: EnvironmentApiOptions
): Promise<PowerPlatformAPI.PowerPlatformResponse> {
  return environmentManagement.getEnvironmentGroupRuleSets(environmentGroupId, options);
}

export async function getEnvironmentManagementSettings(
  environmentId: string,
  options?: EnvironmentApiOptions
): Promise<PowerPlatformAPI.PowerPlatformResponse> {
  return environmentManagement.getEnvironmentManagementSettings(environmentId, options);
}

export async function updateEnvironmentManagementSettings(
  environmentId: string,
  changes: Record<string, string | number | boolean | null>,
  options?: EnvironmentApiOptions
): Promise<PowerPlatformAPI.PowerPlatformResponse> {
  return environmentManagement.updateEnvironmentManagementSettings(environmentId, changes, options);
}

export async function getEnvironmentGroups(
  options?: EnvironmentApiOptions
): Promise<PowerPlatformAPI.PowerPlatformResponse> {
  return environmentManagement.getEnvironmentGroups(options);
}

export async function getEnvironments(
  options?: EnvironmentApiOptions
): Promise<PowerPlatformAPI.PowerPlatformResponse> {
  return environmentManagement.getEnvironments(options);
}
