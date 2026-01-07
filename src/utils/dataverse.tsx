import { orgProp } from "../model/OrgSetting";

interface dvServiceProps {
  connection: ToolBoxAPI.DataverseConnection | null;
  secondaryConnection?: ToolBoxAPI.DataverseConnection | null;
  dvApi: DataverseAPI.API;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}
export class dvService {
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

    // console.log("Update string:", updateString);

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
