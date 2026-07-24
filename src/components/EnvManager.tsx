import React from "react";
import { observer } from "mobx-react";
import { ViewModel } from "../model/ViewModel";
import {
  ModuleRegistry,
  TextFilterModule,
  ClientSideRowModelModule,
  themeQuartz,
} from "ag-grid-community";
import { Tab, TabList, SelectTabData, SelectTabEvent } from "@fluentui/react-components";
import { dvService } from "../utils/dataverse";
import { orgProp } from "../model/OrgSetting";
import { observable, runInAction } from "mobx";
import { OrgSettingsGrid } from "./OrgSettingsGrid";
import { EnvironmentSettingsGrid, EnvApiGridRow } from "./EnvironmentSettingsGrid";
import { getEnvironmentManagementSettings, updateEnvironmentManagementSettings } from "../utils/environmentManagement";

interface EnvApiInfoItem {
  apiName: string;
  shortDescription: string;
  link?: string;
}

const ENV_API_INFO_URL = "https://raw.githubusercontent.com/LinkeD365/PPTB-EnvManager/main/PPApiInfo.json";

ModuleRegistry.registerModules([TextFilterModule, ClientSideRowModelModule]);


const myTheme = themeQuartz.withParams({
  headerHeight: "30px",
});

interface EnvManagerProps {
  connection: ToolBoxAPI.DataverseConnection | null;
  secondaryConnection?: ToolBoxAPI.DataverseConnection | null;
  dvService: dvService;
  isLoading: boolean;
  viewModel: ViewModel;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

function getConnectionKey(connection: ToolBoxAPI.DataverseConnection | null): string {
  if (!connection) {
    return "none";
  }

  const c = connection as unknown as { id?: string; uniqueName?: string; name?: string };
  return `${c.id ?? ""}|${c.uniqueName ?? ""}|${c.name ?? ""}`;
}

const envSettingTextProperties = new Set<string>([
  "Id",
  "TenantId",
  "AllowedIpRangeForStorageAccessSignatures",
  "IpBasedStorageAccessSignatureMode",
  "PowerPages_AllowNonProdPublicSites_Exemptions",
  "CopilotStudio_DisclaimerMessage",
  "CopilotStudio_ComputerUseAppAllowlist",
  "CopilotStudio_ComputerUseWebAllowlist",
  "PowerApps_CSPReportingEndpoint",
  "PowerApps_CSPConfigCodeApps",
  "CopilotStudio_PrivacyDisclosureMessageUrl",
  "CopilotStudio_AgentAuthenticationSettings",
  "MicrosoftApps_GitHubUrl",
  "MicrosoftApps_CSPReportingEndpoint",
  "MicrosoftApps_CSPConfig",
]);

function inferEnvironmentValueType(
  property: string,
  value: unknown
): "boolean" | "text" | "number" {
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "string") {
    return "text";
  }

  if (envSettingTextProperties.has(property) || property.endsWith("Id") || property.endsWith("Url")) {
    return "text";
  }

  // Most EnvironmentManagementSetting flags are booleans, even when null.
  return "boolean";
}

export const EnvManager = observer((props: EnvManagerProps): React.JSX.Element => {
  const { connection, secondaryConnection, isLoading, viewModel, onLog, dvService } = props;
  const connectionKey = React.useMemo(() => getConnectionKey(connection), [connection]);
  const secondaryConnectionKey = React.useMemo(() => getConnectionKey(secondaryConnection ?? null), [secondaryConnection]);
  const [loadingSettings, setLoadingSettings] = React.useState(false);
  const [selectedTab, setSelectedTab] = React.useState("org-settings");
  const [isEnvApiLoading, setIsEnvApiLoading] = React.useState(false);
  const [isEnvApiSaving, setIsEnvApiSaving] = React.useState(false);
  const [isSecondaryEnvApiSaving, setIsSecondaryEnvApiSaving] = React.useState(false);
  const [envApiLoaded, setEnvApiLoaded] = React.useState(false);
  const [envApiSecondaryLoaded, setEnvApiSecondaryLoaded] = React.useState(false);
  const [envApiError, setEnvApiError] = React.useState<string | null>(null);
  const [envApiRows, setEnvApiRows] = React.useState<EnvApiGridRow[]>([]);
  const [envApiEnvironmentId, setEnvApiEnvironmentId] = React.useState<string>("");
  const [secondaryEnvApiEnvironmentId, setSecondaryEnvApiEnvironmentId] = React.useState<string>("");
  const [envApiInfoLookup, setEnvApiInfoLookup] = React.useState<Map<string, EnvApiInfoItem>>(new Map());

  function formatGridValue(value: unknown): string | number | boolean | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    return JSON.stringify(value);
  }

  function createEnvApiGrid(payload: unknown): EnvApiGridRow[] {
    let source: unknown = payload;

    if (Array.isArray(source)) {
      source = source[0];
    }

    if (source && typeof source === "object") {
      const src = source as { objectResult?: unknown; value?: unknown };
      if (Array.isArray(src.objectResult)) {
        source = src.objectResult[0];
      } else if (Array.isArray(src.value)) {
        source = src.value[0];
      }
    }

    let rows: EnvApiGridRow[] = [];
    if (source && typeof source === "object") {
      rows = Object.entries(source as Record<string, unknown>).map(([property, value]) => ({
        property,
        current: formatGridValue(value),
        new: formatGridValue(value),
        edit: false,
        valueType: inferEnvironmentValueType(property, value),
        editable: !(property === "Id" || property === "TenantId"),
      }));
    } else {
      rows = [{ property: "value", current: formatGridValue(source), new: formatGridValue(source), edit: false, valueType: "text", editable: false }];
    }

    return rows;
  }

  function attachEnvApiInfo(rows: EnvApiGridRow[], lookup: Map<string, EnvApiInfoItem>): EnvApiGridRow[] {
    return rows.map((row) => {
      const info = lookup.get(row.property.toLowerCase());
      return {
        ...row,
        shortDescription: info?.shortDescription,
        link: info?.link,
      };
    });
  }

  function mergeSecondaryEnvApiGrid(primaryRows: EnvApiGridRow[], payload: unknown): EnvApiGridRow[] {
    const secondaryRows = createEnvApiGrid(payload);
    const secondaryMap = new Map(secondaryRows.map((row) => [row.property, row]));

    return primaryRows.map((row) => {
      const secondaryRow = secondaryMap.get(row.property);
      return {
        ...row,
        secondaryCurrent: secondaryRow?.current ?? null,
        secondaryNew: secondaryRow?.current ?? null,
      };
    });
  }

  // Define helper functions before they are used in useEffect
  function setItemNewValue(item: orgProp, newValue: string, secondary?: boolean): void {
    runInAction(() => {
      if (secondary) {
        item.secondaryNew = newValue;
      } else {
        item.new = newValue;
      }
    });
  }

  React.useEffect(() => {
    setSelectedTab("org-settings");
    setEnvApiLoaded(false);
    setEnvApiSecondaryLoaded(false);
    setEnvApiRows([]);
    setEnvApiEnvironmentId("");
    setSecondaryEnvApiEnvironmentId("");
    setEnvApiError(null);
  }, [connectionKey, secondaryConnectionKey]);

  React.useEffect(() => {
    let cancelled = false;

    const loadEnvApiInfo = async () => {
      try {
        const response = await fetch(ENV_API_INFO_URL);
        if (!response.ok) {
          throw new Error(`Network response was not ok (${response.status})`);
        }

        const payload = (await response.json()) as EnvApiInfoItem[];
        if (cancelled) {
          return;
        }

        const lookup = new Map(
          payload.map((item) => [item.apiName.trim().toLowerCase(), item])
        );
        setEnvApiInfoLookup(lookup);
      } catch (err) {
        if (!cancelled) {
          onLog(`Unable to load environment setting info: ${String(err)}`, "warning");
        }
      }
    };

    loadEnvApiInfo();

    return () => {
      cancelled = true;
    };
  }, [onLog]);

  React.useEffect(() => {
    if (envApiInfoLookup.size === 0) {
      return;
    }

    setEnvApiRows((prev) => attachEnvApiInfo(prev, envApiInfoLookup));
  }, [envApiInfoLookup]);

  React.useEffect(() => {
    if (!connection) {
      return;
    }

    let cancelled = false;

    const loadEnvironmentSettings = async () => {
      setIsEnvApiLoading(true);
      setEnvApiError(null);
      try {
        const envId = await dvService.getEnvironmentId();
        setEnvApiEnvironmentId(envId);
        const response = await getEnvironmentManagementSettings(envId, { connectionTarget: "primary" });
        if (cancelled) {
          return;
        }

        let gridRows = createEnvApiGrid(response);
        if (secondaryConnection) {
          try {
            const secondaryEnvId = await dvService.getEnvironmentId(true);
            setSecondaryEnvApiEnvironmentId(secondaryEnvId);
            const secondaryResponse = await getEnvironmentManagementSettings(secondaryEnvId, {
              connectionTarget: "secondary",
            });
            if (cancelled) {
              return;
            }

            gridRows = mergeSecondaryEnvApiGrid(gridRows, secondaryResponse);
            setEnvApiSecondaryLoaded(true);
          } catch (secondaryErr) {
            setSecondaryEnvApiEnvironmentId("");
            setEnvApiSecondaryLoaded(false);
            console.warn("[EnvTabs] Secondary environment API load failed", secondaryErr);
            onLog(`Unable to load secondary environment settings: ${String(secondaryErr)}`, "warning");
          }
        } else {
          setSecondaryEnvApiEnvironmentId("");
          setEnvApiSecondaryLoaded(false);
        }

        setEnvApiRows(gridRows);
        setEnvApiError(null);
        setEnvApiLoaded(true);
        onLog("Environment settings loaded from EnvironmentManagement API", "success");
      } catch (err) {
        console.error("[EnvTabs] Environment API load failed", err);
        if (cancelled) {
          return;
        }

        setEnvApiLoaded(false);
        setEnvApiError(String(err));
        onLog(`Unable to load environment settings: ${String(err)}`, "warning");
      } finally {
        if (!cancelled) {
          setIsEnvApiLoading(false);
        }
      }
    };

    loadEnvironmentSettings();

    return () => {
      cancelled = true;
    };
  }, [connection, connectionKey, secondaryConnection, dvService, onLog]);

  const handleEnvironmentToggleEdit = React.useCallback((property: string, edit: boolean) => {
    setEnvApiRows((prev) =>
      prev.map((row) => {
        if (row.property !== property) {
          return row;
        }

        return {
          ...row,
          edit,
          new: edit ? row.new : row.current,
          secondaryNew: edit ? row.secondaryNew : row.secondaryCurrent,
        };
      })
    );
  }, []);

  const handleEnvironmentNewValueChange = React.useCallback((property: string, nextValue: string | number | boolean | null, secondary?: boolean) => {
    setEnvApiRows((prev) =>
      prev.map((row) => {
        if (row.property !== property) {
          return row;
        }

        if (secondary) {
          return { ...row, secondaryNew: nextValue };
        }

        return { ...row, new: nextValue };
      })
    );
  }, []);

  const saveEnvironmentSettings = React.useCallback(async (secondary?: boolean) => {
    const targetLabel = secondary ? "secondary" : "primary";
    const targetEnvironmentId = secondary ? secondaryEnvApiEnvironmentId : envApiEnvironmentId;

    if (!targetEnvironmentId) {
      onLog(`Cannot save ${targetLabel} environment settings: environment id is missing`, "error");
      return;
    }

    const editedItems = envApiRows.filter((row) => {
      if (!row.edit || row.editable === false) {
        return false;
      }

      return secondary ? row.secondaryNew !== row.secondaryCurrent : row.new !== row.current;
    });

    if (editedItems.length === 0) {
      window.toolboxAPI.utils.showNotification({
        title: "No changes to save",
        body: secondary
          ? "No secondary environment settings have been modified."
          : "No environment settings have been modified.",
      });
      return;
    }

    if (secondary) {
      setIsSecondaryEnvApiSaving(true);
    } else {
      setIsEnvApiSaving(true);
    }

    try {
      const payload = editedItems.reduce<Record<string, string | number | boolean | null>>((acc, item) => {
        acc[item.property] = secondary ? item.secondaryNew ?? null : item.new;
        return acc;
      }, {});

      const response = await updateEnvironmentManagementSettings(targetEnvironmentId, payload, {
        connectionTarget: secondary ? "secondary" : "primary",
      });
      const responseObj = response as { errors?: { message?: string } | null; responseMessage?: string };

      if (responseObj.errors || responseObj.responseMessage) {
        const errorMessage = responseObj.errors?.message ?? responseObj.responseMessage ?? "Unknown API error";
        throw new Error(errorMessage);
      }

      setEnvApiRows((prev) =>
        prev.map((row) => {
          const updatedValue = payload[row.property];
          if (updatedValue === undefined) {
            return row;
          }

          if (secondary) {
            return {
              ...row,
              secondaryCurrent: updatedValue,
              secondaryNew: updatedValue,
              edit: false,
            };
          }

          return {
            ...row,
            current: updatedValue,
            new: updatedValue,
            edit: false,
          };
        })
      );
      onLog(`Updated ${editedItems.length} ${targetLabel} environment setting(s) successfully`, "success");
      window.toolboxAPI.utils.showNotification({
        title: "Environment settings updated",
        body: `Saved ${editedItems.length} ${secondary ? "secondary " : ""}setting(s).`,
        type: "success",
        duration: 3000,
      });
    } catch (err) {
      const message = String(err);
      onLog(`Failed to update ${targetLabel} environment settings: ${message}`, "error");
      window.toolboxAPI.utils.showNotification({
        title: `Failed to update ${targetLabel} environment settings`,
        body: message,
        type: "error",
        duration: 4000,
      });
    } finally {
      if (secondary) {
        setIsSecondaryEnvApiSaving(false);
      } else {
        setIsEnvApiSaving(false);
      }
    }
  }, [secondaryEnvApiEnvironmentId, envApiEnvironmentId, envApiRows, onLog]);

  React.useEffect(() => {
    onLog("EnvManager mounted", "info");
    getMcneXML();
    document.body.dataset.agThemeMode = viewModel.theme;
  }, [onLog, viewModel.theme]);

  React.useEffect(() => {
    document.body.dataset.agThemeMode = viewModel.theme;
  }, [viewModel.theme]);

  //Get current settings
  React.useEffect(() => {
    onLog("Loading organization settings...", "info");

    if (connection || secondaryConnection) fetchOrgSettings();
  }, [connection, secondaryConnection, viewModel.blankList.length, onLog]);

  // Get the Sean Mcne Xml
  const getMcneXML = async () => {
    const url =
      "https://raw.githubusercontent.com/seanmcne/OrgDbOrgSettings/master/mspfedyn_/OrgDbOrgSettings/Solution/WebResources/mspfedyn_/OrgDbOrgSettings/Settings.xml";
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Network response was not ok (${res.status})`);
      const xmlSeanMcNe = await res.text();

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlSeanMcNe, "application/xml");
      const defaultOrgSettingsNode = xmlDoc.getElementsByTagName("defaultOrgSettings")[0];
      if (defaultOrgSettingsNode) {
        viewModel.blankList = Array.from(defaultOrgSettingsNode.childNodes)
          .filter(
            (node) =>
              node.nodeType === 1 &&
              (node as Element).nodeName === "orgSetting" &&
              (node as Element).getAttribute("isOrganizationAttribute") === "false"
          )
          .map((node) => {
            const el = node as Element;

            const setting = new orgProp();
            setting.name = el.getAttribute("name") || "";
            setting.description = el.getAttribute("description") || "";
            setting.type = el.getAttribute("settingType") || "";
            setting.min = el.getAttribute("min") || "";
            setting.max = el.getAttribute("max") || "";
            setting.maxVersion = el.getAttribute("maxSupportedVersion") || "";
            setting.minVersion = el.getAttribute("minSupportedVersion") || "";
            setting.default = el.getAttribute("defaultValue") || "";
            setting.url = el.getAttribute("supportUrl") || "";
            setting.urlTitle = el.getAttribute("urlTitle") || "";
            return setting;
          });
        const linkeD365Url = "https://raw.githubusercontent.com/LinkeD365/OrgSettings/master/LinkeD65OrgSettings.xml";
        const linkedD365res = await fetch(linkeD365Url);
        if (!linkedD365res.ok) throw new Error(`Network response was not ok (${linkedD365res.status})`);
        const xmlLD365 = await linkedD365res.text();

        const xmlLD365Doc = parser.parseFromString(xmlLD365, "application/xml");
        // Merge LinkedD365 info into existing fullList by matching names
        const linkedElements = Array.from(xmlLD365Doc.getElementsByTagName("orgSetting")) as Element[];
        runInAction(() => {
          if (!Array.isArray(viewModel.blankList)) return;

          linkedElements.forEach((el) => {
            const name = (el.getAttribute("name") || "").trim();

            const target = viewModel.blankList.find((f) => (f.name || "").toLowerCase() === name.toLowerCase());
            if (target) {
              target.linkeD365Url = el.getAttribute("url") || "";
              target.linkeD365Description = el.getAttribute("description") || "";
            }
          });
        });
      } else {
        viewModel.fullList = [];
      }
      onLog("Sean McNe XML downloaded", "success");
    } catch (error) {
      onLog(`Failed to download Sean McNe XML: ${String(error)}`, "error");
    }
  };

  const fetchOrgSettings = async () => {
    if (!connection) {
      window.toolboxAPI.utils.showNotification({
        title: "No active connection",
        body: "Please connect to a Dataverse environment to use this tool.",
        type: "error",
        duration: 3000,
      });
      return;
    }

    setLoadingSettings(true);

    //Fetch with primary connection
    await dvService
      .getOrgSettings()
      .then(async ([orgId, settings]) => {
        viewModel.primaryOrgId = orgId;
        if (
          Array.isArray(viewModel.blankList) &&
          viewModel.blankList.length > 0 &&
          Array.isArray(settings) &&
          settings.length > 0
        ) {
          const rowMap = new Map(settings.map((r) => [r.name?.toLowerCase() ?? "", r]));

          runInAction(() => {
            viewModel.fullList = observable([]);
            viewModel.blankList.forEach((f) => {
              const match = rowMap.get(f.name?.toLowerCase() ?? "");
              if (match) {
                // Prefer the value from rows for current if present
                if (match.current && match.current !== "") {
                  f.current = match.current;
                }
              }
              viewModel.fullList.push(f);
            });
          });
        }

        if (secondaryConnection) {
          await dvService.getOrgSettings(true).then(([orgId, secSettings]) => {
            viewModel.secondaryOrgId = orgId;

            const secRows = new Map(secSettings.map((r) => [r.name?.toLowerCase() ?? "", r]));

            runInAction(() => {
              viewModel.fullList.forEach((setting) => {
                const match = secRows.get(setting.name?.toLowerCase() ?? "");
                if (match) {
                  // Prefer the value from rows for current if present
                  if (match.current && match.current !== "") {
                    setting.secondaryCurrent = match.current;
                  }
                }
                //viewModel.fullList.push(f);
              });
            });
          });
        }
      })
      .catch((err) => {
        onLog(`Failed to fetch organization settings: ${String(err)}`, "error");
        window.toolboxAPI.utils.showNotification({
          title: "Error fetching organization settings",
          body: `Error: ${String(err)}`,
          type: "error",
          duration: 3000,
        });
      });
    setLoadingSettings(false);
  };

  function saveOrgSettings(secondary?: boolean): void {
    let editedItems = viewModel.fullList.filter((i) => i.edit);
    if (editedItems.length === 0) {
      window.toolboxAPI.utils.showNotification({
        title: "No changes to save",
        body: "No items are in edit mode.",
      });
      onLog("No changes to save", "info");
      return;
    }
    if (secondary) {
      editedItems = editedItems.filter((item) => item.secondaryNew !== item.secondaryCurrent);
    } else {
      editedItems = editedItems.filter((item) => item.new !== item.current);
    }
    if (editedItems.length === 0) {

      window.toolboxAPI.utils.showNotification({
        title: "No changes to save",
        body: "No values have been modified.",
      });
      onLog("No changes to save", "info");
      return;
    }

    const conn = secondary ? secondaryConnection : connection;
    (async () => {
      if (!conn) {
        await window.toolboxAPI.utils.showNotification({
          title: "No active connection",
          body: "Cannot save settings without an active connection.",
          type: "error",
          duration: 3000,
        });
        onLog("No active connection. Cannot save settings.", "error");
        return;
      }

      window.toolboxAPI.utils.showNotification({
        title: "Saving organization settings...",
        body: `Saving ${editedItems.length} organization setting(s)...`,
        type: "info",
        duration: 3000,
      });
      onLog(`Saving ${editedItems.length} organization setting(s)...`, "info");
      try {
        let updateString = "<orgSettings>";
        const settingsList = secondary
          ? viewModel.fullList.filter((it) => it.secondaryCurrent || it.secondaryNew)
          : viewModel.fullList.filter((it) => it.current || it.new);
        settingsList.forEach((it) => {
          updateString += secondary
            ? `<${it.name}>${it.secondaryNew ?? it.secondaryCurrent}</${it.name}>`
            : `<${it.name}>${it.new ?? it.current}</${it.name}>`;
        });
        updateString += "</orgSettings>";
        await dvService
          .updateOrgSettingsXml(
            updateString,
            secondary ? viewModel.secondaryOrgId ?? "" : viewModel.primaryOrgId ?? "",
            !!secondary
          )
          .then(async (result) => {
            if (!result.success) {
              throw new Error(result.error);
            }
            await window.toolboxAPI.utils.showNotification({
              title: "Organization Settings Saved",
              body: "The organization settings have been successfully saved.",
            });
          });

        onLog("Organization settings saved", "success");
        fetchOrgSettings();
      } catch (err) {
        await window.toolboxAPI.utils.showNotification({
          title: "Failed to save organization settings",
          body: `Error: ${String(err)}`,
          type: "error",
          duration: 3000,
        });
        onLog(`Failed to save org settings: ${String(err)}`, "error");
      } finally {
        window.toolboxAPI.utils.showNotification({
          title: "Save operation completed",
          body: "The save operation has completed.",
          type: "info",
          duration: 1000,
        });
      }
    })();
  }

  if (isLoading || loadingSettings) {
    return (
      <div className="card">
        <h2>🌐 Environment Manager</h2>
        <div className="info-box">
          <div className="loading">Loading environment details...</div>
        </div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="card">
        <h2>🔗 Connection Status</h2>
        <div className="info-box warning">
          <p>
            <strong>⚠️ No active connection</strong>
            <br />
            Please connect to a Dataverse environment to use this tool.
          </p>
        </div>
      </div>
    );
  }

  const showTabs = envApiLoaded || Boolean(envApiError);

  return (
    <div style={{ width: "95vw", height: "98vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, marginTop: "8px", display: "flex", flexDirection: "column" }}>
        {showTabs && (
          <TabList
            selectedValue={selectedTab}
            onTabSelect={(_event: SelectTabEvent, data: SelectTabData) => setSelectedTab(String(data.value))}
            size="small"
          >
            <Tab value="org-settings">Organization Settings</Tab>
            <Tab value="environment-settings">Environment Settings API</Tab>
          </TabList>
        )}

        <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", marginTop: showTabs ? "8px" : "0" }}>
          {(!showTabs || selectedTab === "org-settings") && (
            <OrgSettingsGrid
              theme={myTheme}
              rowData={viewModel.fullList}
              connectionName={connection.name}
              secondaryConnectionName={secondaryConnection?.name}
              isPowerPlatformApiUnavailable={Boolean(envApiError)}
              onSavePrimary={() => saveOrgSettings()}
              onSaveSecondary={() => saveOrgSettings(true)}
              setItemNewValue={setItemNewValue}
            />
          )}

          {showTabs && selectedTab === "environment-settings" && (
            <EnvironmentSettingsGrid
              isLoading={isEnvApiLoading}
              error={envApiError}
              isLoaded={envApiLoaded}
              rows={envApiRows}
              connectionName={connection?.name}
              secondaryConnectionName={envApiSecondaryLoaded ? secondaryConnection?.name : undefined}
              isSaving={isEnvApiSaving}
              isSecondarySaving={isSecondaryEnvApiSaving}
              hasPendingChanges={envApiRows.some((row) => row.edit && row.new !== row.current && row.editable !== false)}
              hasSecondaryPendingChanges={envApiRows.some(
                (row) => row.edit && row.secondaryNew !== row.secondaryCurrent && row.editable !== false
              )}
              onToggleEdit={handleEnvironmentToggleEdit}
              onNewValueChange={handleEnvironmentNewValueChange}
              onSave={() => {
                void saveEnvironmentSettings();
              }}
              onSaveSecondary={() => {
                void saveEnvironmentSettings(true);
              }}
              theme={myTheme}
            />
          )}
        </div>
      </div>
    </div>
  );
});
