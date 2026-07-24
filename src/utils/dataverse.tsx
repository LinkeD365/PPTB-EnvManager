import { orgProp } from "../model/OrgSetting";

interface dvServiceProps {
  connection: ToolBoxAPI.DataverseConnection | null;
  secondaryConnection?: ToolBoxAPI.DataverseConnection | null;
  dvApi: DataverseAPI.API;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}
export class dvService {
  private static environmentIdCache = new Map<string, string>();
  private static environmentIdInflight = new Map<string, Promise<string>>();

  connection: ToolBoxAPI.DataverseConnection | null;
  secondaryConnection: ToolBoxAPI.DataverseConnection | null = null;
  dvApi: DataverseAPI.API;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;

  constructor(props: dvServiceProps) {
    this.secondaryConnection = props.secondaryConnection || null;
    this.connection = props.connection;
    this.dvApi = props.dvApi;
    this.onLog = props.onLog;
  }

  private getConnectionTarget(secondary?: boolean): "primary" | "secondary" {
    return secondary ? "secondary" : "primary";
  }

  private getCacheKey(connectionTarget: "primary" | "secondary"): string {
    const conn = connectionTarget === "secondary" ? this.secondaryConnection : this.connection;
    return `${connectionTarget}:${conn?.id ?? conn?.url ?? "unknown"}`;
  }

  private normalizeGuid(value: string): string | null {
    const trimmed = value.trim();
    const match = trimmed.match(/\{?([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\}?/);
    return match ? match[1].toLowerCase() : null;
  }

  private extractEnvironmentId(result: Record<string, unknown>): string | null {
    const tryParse = (value: unknown): string | null => {
      if (typeof value !== "string") {
        return null;
      }
      return this.normalizeGuid(value);
    };

    const direct = tryParse(result.EnvironmentId) ?? tryParse(result.environmentId) ?? tryParse(result.environmentid);
    if (direct) {
      return direct;
    }

    const detail = result.Detail;
    if (detail && typeof detail === "object") {
      const detailObj = detail as Record<string, unknown>;
      return (
        tryParse(detailObj.EnvironmentId) ??
        tryParse(detailObj.environmentId) ??
        tryParse(detailObj.environmentid) ??
        null
      );
    }

    return null;
  }

  async getEnvironmentId(secondary?: boolean, forceRefresh = false): Promise<string> {
    const connectionTarget = this.getConnectionTarget(secondary);
    const conn = connectionTarget === "secondary" ? this.secondaryConnection : this.connection;

    if (!conn) {
      throw new Error(`No ${connectionTarget} Dataverse connection available`);
    }

    const cacheKey = this.getCacheKey(connectionTarget);
    if (!forceRefresh) {
      const cachedEnvironmentId = dvService.environmentIdCache.get(cacheKey);
      if (cachedEnvironmentId) {
        return cachedEnvironmentId;
      }

      const inflight = dvService.environmentIdInflight.get(cacheKey);
      if (inflight) {
        return inflight;
      }
    }

    const request = this.dvApi
      .execute(
        {
          operationName: "RetrieveCurrentOrganization",
          operationType: "function",
          parameters: {
            AccessType: "Microsoft.Dynamics.CRM.EndpointAccessType'Default'",
          },
        },
        connectionTarget
      )
      .then((response) => {
        const environmentId = this.extractEnvironmentId(response);
        if (!environmentId) {
          throw new Error("RetrieveCurrentOrganization did not return an EnvironmentId");
        }

        dvService.environmentIdCache.set(cacheKey, environmentId);
        return environmentId;
      })
      .finally(() => {
        dvService.environmentIdInflight.delete(cacheKey);
      });

    dvService.environmentIdInflight.set(cacheKey, request);
    return request;
  }

  async getOrgSettings(secondary?: boolean): Promise<[string, orgProp[]]> {
    this.onLog("Fetching organization settings...", "info");
    const conn = secondary ? this.secondaryConnection : this.connection;
    if (!conn) throw new Error("No Dataverse connection available");

    const fetchXml = `
<fetch >
  <entity name="organization">
    <attribute name="orgdborgsettings" />
  </entity>
</fetch>`;
    const settings = await this.dvApi.fetchXmlQuery(fetchXml, secondary ? "secondary" : "primary");
    //        setOrgSettings(settings.value[0]);

    const parser = new DOMParser();
    const orgid = settings.value[0].organizationid as string;
    const orgSettingsString = settings.value[0].orgdborgsettings as string;
    const xmlDoc = parser.parseFromString(orgSettingsString, "text/xml");

    const currentRows = Array.from(xmlDoc.documentElement.childNodes).map((node) => {
      const setting = new orgProp();
      setting.name = node.nodeName;
      setting.current = node.textContent || "";
      return setting;
    });

    this.onLog("Organization settings loaded", "success");
    // Try common wrapper patterns first

    return [orgid, currentRows];
  }
  async updateOrgSettingsXml(
    updateString: string,
    orgId: string,
    secondary: boolean
  ): Promise<{ success: true } | { success: false; error: string }> {
    this.onLog("Updating organization settings...", "info");

    if (!this.connection) {
      const errorMessage = "No Dataverse connection available";
      this.onLog(errorMessage, "error");
      return { success: false, error: errorMessage };
    }

    try {
      await this.dvApi.update(
        "organization",
        orgId,
        {
          orgdborgsettings: updateString,
        },
        secondary ? "secondary" : "primary"
      );

      this.onLog("Organization settings updated", "success");
      return { success: true };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.onLog(`Failed to update organization settings: ${errorMessage}`, "error");
      return { success: false, error: errorMessage };
    }
  }
}
