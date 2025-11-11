import { orgProp } from "../model/OrgSetting";

interface dvServiceProps {
  connection: ToolBoxAPI.DataverseConnection | null;
  dvApi: DataverseAPI.API;
  onLog: (
    message: string,
    type?: "info" | "success" | "warning" | "error"
  ) => void;
}
export class dvService {
  connection: ToolBoxAPI.DataverseConnection | null;
  dvApi: DataverseAPI.API;
  onLog: (
    message: string,
    type?: "info" | "success" | "warning" | "error"
  ) => void;

  constructor(props: dvServiceProps) {
    this.connection = props.connection;
    this.dvApi = props.dvApi;
    this.onLog = props.onLog;
  }

  async getOrgSettings(): Promise<[string, orgProp[]]> {
    this.onLog("Fetching organization settings...", "info");
    if (!this.connection || !this.connection.isActive)
      throw new Error("No Dataverse connection available");

    const fetchXml = `
<fetch >
  <entity name="organization">
    <attribute name="orgdborgsettings" />
  </entity>
</fetch>`;
    const settings = await this.dvApi.fetchXmlQuery(fetchXml);
    //        setOrgSettings(settings.value[0]);

    const parser = new DOMParser();
    const orgid = settings.value[0].organizationid as string;
    const orgSettingsString = settings.value[0].orgdborgsettings as string;
    const xmlDoc = parser.parseFromString(orgSettingsString, "text/xml");

    const currentRows = Array.from(xmlDoc.documentElement.childNodes).map(
      (node) => {
        const setting = new orgProp();
        setting.name = node.nodeName;
        setting.current = node.textContent || "";
        return setting;
      }
    );

    this.onLog("Organization settings loaded", "success");
    // Try common wrapper patterns first

    return [orgid, currentRows];
  }
  async updateOrgSettingsXml(
    updateString: string,
    orgId: string
  ): Promise<{ success: true } | { success: false; error: string }> {
    this.onLog("Updating organization settings...", "info");
    
   // console.log("Update string:", updateString);

    if (!this.connection || !this.connection.isActive) {
      const errorMessage = "No Dataverse connection available";
      this.onLog(errorMessage, "error");
      return { success: false, error: errorMessage };
    }

    try {
      await this.dvApi.update("organization", orgId, {
        orgdborgsettings: updateString,
      });

      this.onLog("Organization settings updated", "success");
      return { success: true };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.onLog(
        `Failed to update organization settings: ${errorMessage}`,
        "error"
      );
      return { success: false, error: errorMessage };
    }
  }
}
