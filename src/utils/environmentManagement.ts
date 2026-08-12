import envGroupRulesFallback from "../data/EnvGrpRules.json";

interface EnvironmentApiOptions {
  connectionTarget?: "primary" | "secondary";
}

const API_VERSION = "2024-10-01";
const ENV_GROUP_RULES_URL = "https://raw.githubusercontent.com/LinkeD365/PPTB-EnvManager/main/EnvGrpRules.json";


export interface EnvironmentGroupPolicyRule {
  policyId: string;
  policyName: string;
  policyDescription?: string;
  ruleText: string;
}

export interface RuleSetUpdateContext {
  kind: "ruleSet";
  /** The id of the Rule Set to PUT to (governance/ruleSets/{ruleSetId}). */
  ruleSetId: string;
  /** The raw Rule Set (RuleSetDto) this value belongs to, used to reconstruct the update payload. */
  ruleSet: Record<string, unknown>;
  /** The RuleSetParameters "type" (e.g. "CodeAppsFeature") this value belongs to; may not yet exist in ruleSet.parameters. */
  parameterType: string;
  /** The MgGovRule "id" (property name) to set; may not yet exist within the parameter's value array. */
  propertyName: string;
}

export interface RuleBasedPolicyUpdateContext {
  kind: "ruleBasedPolicy";
  /** The id of the policy to PATCH (governance/ruleBasedPolicies/{policyId}). */
  policyId: string;
  /** The raw Policy this value belongs to, used to reconstruct the update payload. */
  policy: Record<string, unknown>;
  /** Index of the RuleSet entry within policy.ruleSets. */
  ruleSetIndex: number;
  /** Key within ruleSets[ruleSetIndex].inputs to update. */
  inputKey: string;
}

export type PolicyRowUpdateContext = RuleSetUpdateContext | RuleBasedPolicyUpdateContext;

export interface RuleSetUIConfigurationComponent {
  componentId: string;
  componentType: string;
  text: string;
  altText?: string;
  learnMoreText?: string;
  learnMoreLink?: string;
  property: {
    name: string;
    type: string;
    defaultValue?: string;
  };
}

export interface RuleSetUIConfiguration {
  ruleSetId: string;
  featureFlag?: string;
  version?: string;
  name: string;
  description?: string;
  learnMoreText?: string;
  learnMoreLink?: string;
  isPreview?: boolean;
  enableConfigBasedRuleRender?: boolean;
  components: RuleSetUIConfigurationComponent[];
}

type RuleSetUIConfigLookup = Map<
  string,
  { config: RuleSetUIConfiguration; componentsByProperty: Map<string, RuleSetUIConfigurationComponent> }
>;

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
  /** Whether this row's value can be updated via the Update Rule Set / Patch Rule Based Policy API. */
  editable?: boolean;
  /** The underlying data type of the value, used to pick a suitable edit control. */
  valueType?: "boolean" | "number" | "text";
  /** Friendly display label sourced from the Rule Set UI Configuration, if available (falls back to ruleSetId). */
  displayName?: string;
  /** Friendly description sourced from the Rule Set UI Configuration, if available. */
  description?: string;
  /** Whether this rule set/feature is marked as preview in the Rule Set UI Configuration. */
  isPreview?: boolean;
  learnMoreText?: string;
  learnMoreLink?: string;
  /** Present when editable is true; identifies where/how to apply an update. */
  updateContext?: PolicyRowUpdateContext;
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

  private async putGovernance(
    endpoint: string,
    body: Record<string, unknown>,
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    return window.powerplatformAPI.Governance.Put(endpoint, body, this.getConnectionTarget(options));
  }

  private async patchGovernance(
    endpoint: string,
    body: Record<string, unknown>,
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    return window.powerplatformAPI.Governance.Patch(endpoint, body, this.getConnectionTarget(options));
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

  async getRuleSetUIConfigurations(
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const endpoint = `rulesetUIConfigurations?api-version=${API_VERSION}`;
    console.log("[EnvironmentManagementUtils] Fetching rule set UI configurations", { endpoint });
    const response = await window.powerplatformAPI.Governance.Get(endpoint, this.getConnectionTarget(options));
    console.log("[EnvironmentManagementUtils] Rule set UI configurations response", { endpoint, response });
    return response;
  }

  async updateRuleSet(
    ruleSetId: string,
    ruleSet: Record<string, unknown>,
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const endpoint = `ruleSets/${ruleSetId}?api-version=${API_VERSION}`;
    console.log("[EnvironmentManagementUtils] Updating rule set", { ruleSetId, endpoint, ruleSet });
    const response = await this.putGovernance(endpoint, ruleSet, options);
    console.log("[EnvironmentManagementUtils] Update rule set response", { ruleSetId, endpoint, response });
    return response;
  }

  async updateRuleBasedPolicy(
    policyId: string,
    payload: { name?: string; ruleSets: Array<Record<string, unknown>> },
    options?: EnvironmentApiOptions
  ): Promise<PowerPlatformAPI.PowerPlatformResponse> {
    const endpoint = `ruleBasedPolicies/${policyId}?api-version=${API_VERSION}`;
    console.log("[EnvironmentManagementUtils] Patching rule-based policy", { policyId, endpoint, payload });
    const response = await this.patchGovernance(endpoint, payload, options);
    console.log("[EnvironmentManagementUtils] Patch rule-based policy response", { policyId, endpoint, response });
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

  /** Converts a scalar (or arbitrary) value to a display/edit string without misrepresenting empty strings. */
  private stringifyScalar(value: unknown): string {
    if (value === undefined || value === null) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return JSON.stringify(value);
  }

  /** Determines a suitable edit control type based on the underlying value's data type. */
  private detectValueType(value: unknown): "boolean" | "number" | "text" {
    if (typeof value === "boolean") {
      return "boolean";
    }

    if (typeof value === "number") {
      return "number";
    }

    return "text";
  }

  /** Maps a Rule Set UI Configuration property type (e.g. "Boolean") to a suitable edit control type. */
  private mapConfigPropertyType(type: string | undefined): "boolean" | "number" | "text" | undefined {
    if (!type) {
      return undefined;
    }

    const normalized = type.toLowerCase();
    if (normalized === "boolean") {
      return "boolean";
    }

    if (normalized === "number" || normalized === "integer" || normalized === "int") {
      return "number";
    }

    if (normalized === "string" || normalized === "text") {
      return "text";
    }

    return undefined;
  }

  private normalizeRuleSetUIConfigurations(payload: unknown): RuleSetUIConfiguration[] {
    return this.normalizePayloadArray(payload)
      .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null))
      .filter((entry): entry is Record<string, unknown> => entry !== null)
      .map((entry) => {
        const componentsPayload = Array.isArray(entry.components) ? entry.components : [];
        const components = componentsPayload
          .map((component) => (component && typeof component === "object" ? (component as Record<string, unknown>) : null))
          .filter((component): component is Record<string, unknown> => component !== null)
          .map((component) => {
            const propertyRecord =
              component.property && typeof component.property === "object"
                ? (component.property as Record<string, unknown>)
                : {};

            return {
              componentId: this.extractText(component.componentId),
              componentType: this.extractText(component.componentType),
              text: this.extractText(component.text),
              altText: this.extractText(component.altText) || undefined,
              learnMoreText: this.extractText(component.learnMoreText) || undefined,
              learnMoreLink: this.extractText(component.learnMoreLink) || undefined,
              property: {
                name: this.extractText(propertyRecord.name),
                type: this.extractText(propertyRecord.type),
                defaultValue: this.extractText(propertyRecord.defaultValue) || undefined,
              },
            };
          });

        return {
          ruleSetId: this.extractText(entry.ruleSetId),
          featureFlag: this.extractText(entry.featureFlag) || undefined,
          version: this.extractText(entry.version) || undefined,
          name: this.extractText(entry.name) || this.extractText(entry.ruleSetId),
          description: this.extractText(entry.description) || undefined,
          learnMoreText: this.extractText(entry.learnMoreText) || undefined,
          learnMoreLink: this.extractText(entry.learnMoreLink) || undefined,
          isPreview: typeof entry.isPreview === "boolean" ? entry.isPreview : undefined,
          enableConfigBasedRuleRender:
            typeof entry.enableConfigBasedRuleRender === "boolean" ? entry.enableConfigBasedRuleRender : undefined,
          components,
        };
      })
      .filter((config) => Boolean(config.ruleSetId));
  }

  private buildRuleSetUIConfigLookup(configs: RuleSetUIConfiguration[]): RuleSetUIConfigLookup {
    const lookup: RuleSetUIConfigLookup = new Map();

    for (const config of configs) {
      const componentsByProperty = new Map<string, RuleSetUIConfigurationComponent>();
      for (const component of config.components) {
        if (component.property.name) {
          componentsByProperty.set(component.property.name.toLowerCase(), component);
        }
      }

      lookup.set(config.ruleSetId.toLowerCase(), { config, componentsByProperty });
    }

    return lookup;
  }

  private envGroupRulesLookupPromise: Promise<Map<string, { name: string; description?: string }>> | null = null;

  /** Builds a { apiName (lowercased) -> {name, description} } lookup from an EnvGrpRules.json-shaped payload. */
  private buildEnvGroupRulesLookup(payload: unknown): Map<string, { name: string; description?: string }> {
    const lookup = new Map<string, { name: string; description?: string }>();
    if (!Array.isArray(payload)) {
      return lookup;
    }

    for (const entry of payload) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const record = entry as Record<string, unknown>;
      const apiName = this.extractText(record.apiName);
      const name = this.extractText(record.shortDescription);
      if (!apiName || !name) {
        continue;
      }

      const description = this.extractText(record.longDescription) || undefined;
      lookup.set(apiName.toLowerCase(), { name, description });
    }

    return lookup;
  }

  /**
   * Fetches friendly rule set names/descriptions from EnvGrpRules.json, preferring the copy hosted on
   * GitHub (kept up to date independently of releases) and falling back to the bundled local copy if the
   * network request fails. Cached for the lifetime of this instance.
   */
  private async getEnvGroupRulesLookup(): Promise<Map<string, { name: string; description?: string }>> {
    if (!this.envGroupRulesLookupPromise) {
      this.envGroupRulesLookupPromise = (async () => {
        try {
          const response = await fetch(ENV_GROUP_RULES_URL);
          if (!response.ok) {
            throw new Error(`Network response was not ok (${response.status})`);
          }

          const payload = await response.json();
          return this.buildEnvGroupRulesLookup(payload);
        } catch (err) {
          console.warn("[EnvironmentManagementUtils] Unable to load EnvGrpRules.json from GitHub, using local fallback", err);
          return this.buildEnvGroupRulesLookup(envGroupRulesFallback);
        }
      })();
    }

    return this.envGroupRulesLookupPromise;
  }

  /**
   * Fills in friendly names/descriptions from EnvGrpRules.json for any ruleSetId/parameterType not
   * already present in the (live) Rule Set UI Configuration lookup, without touching entries that
   * already have UI configuration-sourced component metadata.
   */
  private mergeEnvGroupRulesIntoUIConfigLookup(
    uiConfigLookup: RuleSetUIConfigLookup,
    envGroupRulesLookup: Map<string, { name: string; description?: string }>
  ): void {
    for (const [key, info] of envGroupRulesLookup) {
      if (uiConfigLookup.has(key)) {
        continue;
      }

      uiConfigLookup.set(key, {
        config: {
          ruleSetId: key,
          name: info.name,
          description: info.description,
          components: [],
        },
        componentsByProperty: new Map(),
      });
    }
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

  private normalizePolicyRows(policy: unknown, uiConfigLookup: RuleSetUIConfigLookup): EnvironmentGroupPolicyRuleSetRow[] {
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
          editable: false,
          displayName: undefined,
          description: undefined,
          isPreview: undefined,
          learnMoreText: undefined,
          learnMoreLink: undefined,
          updateContext: undefined,
        },
      ];
    }

    return ruleSets.flatMap((ruleSet, ruleSetIndex) => {
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
      const uiConfigEntry = uiConfigLookup.get(ruleSetId.toLowerCase());
      const ruleSetDisplayName = uiConfigEntry?.config.name ?? ruleSetId;
      const inputEntries = Object.entries(inputs);
      const existingInputKeys = new Set(inputEntries.map(([inputLabel]) => inputLabel.toLowerCase()));

      const inputRows: EnvironmentGroupPolicyRuleSetRow[] =
        inputEntries.length === 0
          ? uiConfigEntry && !isConnectorManagementRuleSet && uiConfigEntry.config.components.length > 0
            ? uiConfigEntry.config.components.map((component) => ({
                policyId,
                policyName,
                ruleSetId: `${ruleSetId} / ${component.property.name}`,
                version: this.extractText(ruleSetRecord.version),
                allowedConnectorNames: [],
                inputsText: JSON.stringify(inputs, null, 2),
                rowType: "ruleSet" as const,
                rowKey: `${policyId}::${ruleSetId}::${component.property.name}`,
                editable: true,
                valueType: this.mapConfigPropertyType(component.property.type) ?? "text",
                displayName: `${ruleSetDisplayName} / ${component.text}`,
                description: component.altText ?? uiConfigEntry.config.description,
                isPreview: uiConfigEntry.config.isPreview,
                learnMoreText: component.learnMoreText ?? uiConfigEntry.config.learnMoreText,
                learnMoreLink: component.learnMoreLink ?? uiConfigEntry.config.learnMoreLink,
                updateContext: {
                  kind: "ruleBasedPolicy",
                  policyId,
                  policy: record,
                  ruleSetIndex,
                  inputKey: component.property.name,
                } satisfies RuleBasedPolicyUpdateContext,
              }))
            : [
                {
                  policyId,
                  policyName,
                  ruleSetId,
                  version: this.extractText(ruleSetRecord.version),
                  allowedConnectorNames: [],
                  inputsText: JSON.stringify(inputs, null, 2),
                  rowType: "ruleSet",
                  rowKey: `${policyId}::${ruleSetId}`,
                  editable: false,
                  displayName: ruleSetDisplayName,
                  description: uiConfigEntry?.config.description,
                  isPreview: uiConfigEntry?.config.isPreview,
                  learnMoreText: uiConfigEntry?.config.learnMoreText,
                  learnMoreLink: uiConfigEntry?.config.learnMoreLink,
                  updateContext: undefined,
                },
              ]
          : inputEntries.map(([inputLabel, inputValue]) => {
              const rowValue = isConnectorManagementRuleSet ? "" : this.stringifyScalar(inputValue);
              const displayRuleSetId = isConnectorManagementRuleSet ? ruleSetId : `${ruleSetId} / ${inputLabel}`;
              const editable =
                !isConnectorManagementRuleSet &&
                (inputValue === undefined || inputValue === null || typeof inputValue !== "object");
              const component = uiConfigEntry?.componentsByProperty.get(inputLabel.toLowerCase());

              return {
                policyId,
                policyName,
                ruleSetId: displayRuleSetId,
                version: this.extractText(ruleSetRecord.version),
                allowedConnectorNames: rowValue ? [rowValue] : [],
                inputsText: JSON.stringify(inputs, null, 2),
                rowType: "ruleSet" as const,
                rowKey: `${policyId}::${ruleSetId}::${inputLabel}`,
                editable,
                valueType: this.mapConfigPropertyType(component?.property.type) ?? this.detectValueType(inputValue),
                displayName: component ? `${ruleSetDisplayName} / ${component.text}` : displayRuleSetId,
                description: component?.altText ?? uiConfigEntry?.config.description,
                isPreview: uiConfigEntry?.config.isPreview,
                learnMoreText: component?.learnMoreText ?? uiConfigEntry?.config.learnMoreText,
                learnMoreLink: component?.learnMoreLink ?? uiConfigEntry?.config.learnMoreLink,
                updateContext: editable
                  ? ({
                      kind: "ruleBasedPolicy",
                      policyId,
                      policy: record,
                      ruleSetIndex,
                      inputKey: inputLabel,
                    } satisfies RuleBasedPolicyUpdateContext)
                  : undefined,
              };
            });

      const missingComponentRows: EnvironmentGroupPolicyRuleSetRow[] =
        uiConfigEntry && !isConnectorManagementRuleSet && inputEntries.length > 0
          ? uiConfigEntry.config.components
              .filter((component) => !existingInputKeys.has(component.property.name.toLowerCase()))
              .map((component) => ({
                policyId,
                policyName,
                ruleSetId: `${ruleSetId} / ${component.property.name}`,
                version: this.extractText(ruleSetRecord.version),
                allowedConnectorNames: [],
                inputsText: JSON.stringify(inputs, null, 2),
                rowType: "ruleSet" as const,
                rowKey: `${policyId}::${ruleSetId}::${component.property.name}`,
                editable: true,
                valueType: this.mapConfigPropertyType(component.property.type) ?? "text",
                displayName: `${ruleSetDisplayName} / ${component.text}`,
                description: component.altText ?? uiConfigEntry.config.description,
                isPreview: uiConfigEntry.config.isPreview,
                learnMoreText: component.learnMoreText ?? uiConfigEntry.config.learnMoreText,
                learnMoreLink: component.learnMoreLink ?? uiConfigEntry.config.learnMoreLink,
                updateContext: {
                  kind: "ruleBasedPolicy",
                  policyId,
                  policy: record,
                  ruleSetIndex,
                  inputKey: component.property.name,
                } satisfies RuleBasedPolicyUpdateContext,
              }))
          : [];

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
              editable: false,
              displayName: `${ruleSetDisplayName} / AllowedConnector`,
              description: uiConfigEntry?.config.description,
              isPreview: uiConfigEntry?.config.isPreview,
              learnMoreText: uiConfigEntry?.config.learnMoreText,
              learnMoreLink: uiConfigEntry?.config.learnMoreLink,
              updateContext: undefined,
            }))
          : [];

      return [...inputRows, ...missingComponentRows, ...connectorRows];
    });
  }

  private normalizeEnvironmentGroupRuleSetRows(
    payload: unknown,
    uiConfigLookup: RuleSetUIConfigLookup,
    coveredParameterTypes: Set<string>
  ): EnvironmentGroupPolicyRuleSetRow[] {
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const record = payload as Record<string, unknown>;
    const sourceId = this.extractText(record.id) || "environment-group-rule-set";
    const parameters = Array.isArray(record.parameters) ? record.parameters : [];

    return parameters.flatMap((parameter, parameterIndex) => {
      const parameterRecord = parameter && typeof parameter === "object" ? (parameter as Record<string, unknown>) : {};
      const parameterType = this.extractText(parameterRecord.type) || "RuleSet";
      coveredParameterTypes.add(parameterType.toLowerCase());
      const isConnectorManagementParameter = parameterType.toLowerCase() === "connectormanagement";
      const parameterValues = Array.isArray(parameterRecord.value) ? parameterRecord.value : [];
      const uiConfigEntry = uiConfigLookup.get(parameterType.toLowerCase());
      const ruleSetDisplayName = uiConfigEntry?.config.name ?? parameterType;

      if (parameterValues.length === 0) {
        if (uiConfigEntry && !isConnectorManagementParameter && uiConfigEntry.config.components.length > 0) {
          return uiConfigEntry.config.components.map((component) => ({
            policyId: sourceId,
            policyName: parameterType,
            ruleSetId: `${parameterType} / ${component.property.name}`,
            version: "",
            allowedConnectorNames: [],
            inputsText: "",
            rowType: "ruleSet" as const,
            rowKey: `${sourceId}::${parameterType}::${component.property.name}`,
            editable: true,
            valueType: this.mapConfigPropertyType(component.property.type) ?? "text",
            displayName: `${ruleSetDisplayName} / ${component.text}`,
            description: component.altText ?? uiConfigEntry.config.description,
            isPreview: uiConfigEntry.config.isPreview,
            learnMoreText: component.learnMoreText ?? uiConfigEntry.config.learnMoreText,
            learnMoreLink: component.learnMoreLink ?? uiConfigEntry.config.learnMoreLink,
            updateContext: {
              kind: "ruleSet",
              ruleSetId: sourceId,
              ruleSet: record,
              parameterType,
              propertyName: component.property.name,
            } satisfies RuleSetUpdateContext,
          }));
        }

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
            editable: false,
            valueType: "text",
            displayName: ruleSetDisplayName,
            description: uiConfigEntry?.config.description,
            isPreview: uiConfigEntry?.config.isPreview,
            learnMoreText: uiConfigEntry?.config.learnMoreText,
            learnMoreLink: uiConfigEntry?.config.learnMoreLink,
            updateContext: undefined,
          },
        ];
      }

      const existingPropertyNames = new Set(
        parameterValues
          .map((value) => (value && typeof value === "object" ? this.extractText((value as Record<string, unknown>).id) : ""))
          .filter((id) => Boolean(id))
          .map((id) => id.toLowerCase())
      );

      const valueRows = parameterValues.map((parameterValue, valueIndex) => {
        const valueRecord =
          parameterValue && typeof parameterValue === "object" ? (parameterValue as Record<string, unknown>) : {};
        const valueId = this.extractText(valueRecord.id) || `value-${valueIndex + 1}`;
        const rawValue = valueRecord.value;
        const normalizedValue = isConnectorManagementParameter ? "" : this.stringifyScalar(rawValue);
        const editable = !isConnectorManagementParameter && (rawValue === undefined || rawValue === null || typeof rawValue !== "object");
        const component = uiConfigEntry?.componentsByProperty.get(valueId.toLowerCase());

        return {
          policyId: sourceId,
          policyName: parameterType,
          ruleSetId: `${parameterType} / ${valueId}`,
          version: "",
          allowedConnectorNames: normalizedValue ? [normalizedValue] : [],
          inputsText: "",
          rowType: "ruleSet" as const,
          rowKey: `${sourceId}::${parameterType}::${valueId}::${valueIndex}`,
          editable,
          valueType: this.mapConfigPropertyType(component?.property.type) ?? this.detectValueType(rawValue),
          displayName: component ? `${ruleSetDisplayName} / ${component.text}` : `${ruleSetDisplayName} / ${valueId}`,
          description: component?.altText ?? uiConfigEntry?.config.description,
          isPreview: uiConfigEntry?.config.isPreview,
          learnMoreText: component?.learnMoreText ?? uiConfigEntry?.config.learnMoreText,
          learnMoreLink: component?.learnMoreLink ?? uiConfigEntry?.config.learnMoreLink,
          updateContext: editable
            ? ({
                kind: "ruleSet",
                ruleSetId: sourceId,
                ruleSet: record,
                parameterType,
                propertyName: valueId,
              } satisfies RuleSetUpdateContext)
            : undefined,
        };
      });

      const missingComponentRows: EnvironmentGroupPolicyRuleSetRow[] =
        uiConfigEntry && !isConnectorManagementParameter
          ? uiConfigEntry.config.components
              .filter((component) => !existingPropertyNames.has(component.property.name.toLowerCase()))
              .map((component) => ({
                policyId: sourceId,
                policyName: parameterType,
                ruleSetId: `${parameterType} / ${component.property.name}`,
                version: "",
                allowedConnectorNames: [],
                inputsText: "",
                rowType: "ruleSet" as const,
                rowKey: `${sourceId}::${parameterType}::${component.property.name}`,
                editable: true,
                valueType: this.mapConfigPropertyType(component.property.type) ?? "text",
                displayName: `${ruleSetDisplayName} / ${component.text}`,
                description: component.altText ?? uiConfigEntry.config.description,
                isPreview: uiConfigEntry.config.isPreview,
                learnMoreText: component.learnMoreText ?? uiConfigEntry.config.learnMoreText,
                learnMoreLink: component.learnMoreLink ?? uiConfigEntry.config.learnMoreLink,
                updateContext: {
                  kind: "ruleSet",
                  ruleSetId: sourceId,
                  ruleSet: record,
                  parameterType,
                  propertyName: component.property.name,
                } satisfies RuleSetUpdateContext,
              }))
          : [];

      return [...valueRows, ...missingComponentRows];
    });
  }

  /**
   * Builds additional, purely-client-side rows for Rule Set UI Configuration entries that have no
   * representation at all within the environment group's Rule Set (i.e. no RuleSetParameters entry
   * with a matching "type"). Attached to the first available RuleSetDto so it can be PUT to on save;
   * a brand-new RuleSetParameters entry (with a best-effort "resourceType" borrowed from a sibling
   * parameter, if any) is created on save.
   */
  private buildMissingRuleSetParameterRows(
    containerRecord: Record<string, unknown>,
    uiConfigLookup: RuleSetUIConfigLookup,
    coveredParameterTypes: Set<string>
  ): EnvironmentGroupPolicyRuleSetRow[] {
    const sourceId = this.extractText(containerRecord.id) || "environment-group-rule-set";
    const rows: EnvironmentGroupPolicyRuleSetRow[] = [];

    for (const [parameterTypeKey, uiConfigEntry] of uiConfigLookup) {
      if (coveredParameterTypes.has(parameterTypeKey) || uiConfigEntry.config.components.length === 0) {
        continue;
      }

      const parameterType = uiConfigEntry.config.ruleSetId;
      const ruleSetDisplayName = uiConfigEntry.config.name;

      for (const component of uiConfigEntry.config.components) {
        rows.push({
          policyId: sourceId,
          policyName: parameterType,
          ruleSetId: `${parameterType} / ${component.property.name}`,
          version: "",
          allowedConnectorNames: [],
          inputsText: "",
          rowType: "ruleSet",
          rowKey: `${sourceId}::${parameterType}::${component.property.name}`,
          editable: true,
          valueType: this.mapConfigPropertyType(component.property.type) ?? "text",
          displayName: `${ruleSetDisplayName} / ${component.text}`,
          description: component.altText ?? uiConfigEntry.config.description,
          isPreview: uiConfigEntry.config.isPreview,
          learnMoreText: component.learnMoreText ?? uiConfigEntry.config.learnMoreText,
          learnMoreLink: component.learnMoreLink ?? uiConfigEntry.config.learnMoreLink,
          updateContext: {
            kind: "ruleSet",
            ruleSetId: sourceId,
            ruleSet: containerRecord,
            parameterType,
            propertyName: component.property.name,
          } satisfies RuleSetUpdateContext,
        });
      }
    }

    return rows;
  }

  async getEnvironmentGroupPolicyRules(
    environmentGroupId: string,
    options?: EnvironmentApiOptions
  ): Promise<EnvironmentGroupPolicyRuleSetRow[]> {
    const [assignmentsResponse, ruleSetsResponse, uiConfigurationsResponse, envGroupRulesLookup] = await Promise.all([
      this.getEnvironmentGroupPolicyAssignments(environmentGroupId, options),
      this.getEnvironmentGroupRuleSets(environmentGroupId, options),
      this.getRuleSetUIConfigurations(options),
      this.getEnvGroupRulesLookup(),
    ]);

    const uiConfigLookup = this.buildRuleSetUIConfigLookup(this.normalizeRuleSetUIConfigurations(uiConfigurationsResponse));
    this.mergeEnvGroupRulesIntoUIConfigLookup(uiConfigLookup, envGroupRulesLookup);

    console.log("[EnvironmentManagementUtils] Environment group policy assignments response", {
      environmentGroupId,
      assignmentsResponse,
    });
    const assignmentRows = this.normalizePayloadArray(assignmentsResponse);
    console.log("[EnvironmentManagementUtils] Environment group rule sets response", {
      environmentGroupId,
      ruleSetsResponse,
    });
    const coveredParameterTypes = new Set<string>();
    const ruleSetPayloadEntries = this.normalizePayloadArray(ruleSetsResponse);
    const ruleSetRows = ruleSetPayloadEntries.flatMap((entry) =>
      this.normalizeEnvironmentGroupRuleSetRows(entry, uiConfigLookup, coveredParameterTypes)
    );
    const firstRuleSetContainer =
      ruleSetPayloadEntries.length > 0 && ruleSetPayloadEntries[0] && typeof ruleSetPayloadEntries[0] === "object"
        ? (ruleSetPayloadEntries[0] as Record<string, unknown>)
        : null;
    const missingRuleSetRows = firstRuleSetContainer
      ? this.buildMissingRuleSetParameterRows(firstRuleSetContainer, uiConfigLookup, coveredParameterTypes)
      : [];
    const policyIds = Array.from(
      new Set(
        assignmentRows
          .map((entry) => (entry && typeof entry === "object" ? this.extractPolicyId(entry as Record<string, unknown>) : ""))
          .filter((policyId) => Boolean(policyId))
      )
    );

    const details =
      policyIds.length > 0
        ? await Promise.all(
            policyIds.map(async (policyId) => {
              const response = await this.getRuleBasedPolicy(policyId, options);
              const normalized = this.normalizePayloadArray(response);
              return this.normalizePolicyRows(normalized[0] ?? response, uiConfigLookup);
            })
          )
        : [];

    const rowsByKey = new Map<string, EnvironmentGroupPolicyRuleSetRow>();
    for (const row of [...ruleSetRows, ...missingRuleSetRows, ...details.flat()]) {
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
