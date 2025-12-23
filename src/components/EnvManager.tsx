import React from "react";
import { observer } from "mobx-react";
import { ViewModel } from "../model/ViewModel";
import { ArrowUndoRegular, EditRegular, Save20Filled } from "@fluentui/react-icons";
import {
  ModuleRegistry,
  TextFilterModule,
  ClientSideRowModelModule,
  themeQuartz,
  ColGroupDef,
} from "ag-grid-community";
import { AgGridReact, CustomCellRendererProps, CustomInnerHeaderProps } from "ag-grid-react";

ModuleRegistry.registerModules([TextFilterModule, ClientSideRowModelModule]);

import { Button } from "@fluentui/react-components";
import { dvService } from "../utils/dataverse";
import { orgProp } from "../model/OrgSetting";
import { observable, runInAction } from "mobx";
import { InputControl } from "./InputControl";
import { InfoPopup } from "./Info";

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

function setItemEdit(item: orgProp, edit: boolean) {
  console.log("Setting edit for", item.name, "to", edit);
  runInAction(() => {
    item.edit = edit;
    item.new = item.current;
  });
}

export const EnvManager = observer((props: EnvManagerProps): React.JSX.Element => {
  const { connection, secondaryConnection, isLoading, viewModel, onLog, dvService } = props;
  const [loadingSettings, setLoadingSettings] = React.useState(false);

  // Column Definitions: Defines the columns to be displayed.
  const [colDefs, setColDefs] = React.useState<ColGroupDef<orgProp>[]>([
    {
      headerName: "",
      children: [{ colId: "Edit", resizable: false, width: 50, sortable: false }, { field: "name" }],
    },
    {
      headerName: connection ? connection.name : "Primary Connection",
      children: [
        { field: "current", headerName: connection ? `${connection.name} Current Value` : "Current Value" },
        { field: "new", headerName: connection ? `${connection.name} New Value` : "New Value" },
      ],
    },
  ]);

  React.useEffect(() => {
    const secondaryHeaders: ColGroupDef<orgProp>[] = secondaryConnection
      ? [
          {
            headerName: secondaryConnection.name,
            children: [
              { field: "secondaryCurrent", headerName: `Current Value`, flex: 1 },
              {
                field: "new",
                flex: 1,
                headerName: "New Value",
                headerComponent: saveHeaderSecondaryButton,
                cellRenderer: (params: { data: orgProp }) => (
                  <InputControl item={params.data!} setItemNewValue={setItemNewValue} secondary={true} />
                ),
              },
            ],
          },
        ]
      : [];

    setColDefs([
      {
        headerName: "",
        children: [
          { colId: "Edit", resizable: false, width: 50, sortable: false, headerName: "", cellRenderer: cellIcon },
          { colId: "Info", resizable: false, width: 50, sortable: false, headerName: "", cellRenderer: cellInfo },
          { field: "name", headerName: "Name", filter: true, flex: 2 },
        ],
      },
      {
        headerName: connection ? connection.name : "Primary Connection",
        children: [
          { field: "current", headerName: "Current Value", flex: 1 },
          {
            field: "new",
            flex: 1,
            headerName: "New Value",
            headerComponent: saveHeaderButton,
            cellRenderer: (params: { data: orgProp }) => (
              <InputControl item={params.data!} setItemNewValue={setItemNewValue} secondary={false} />
            ),
          },
        ],
      },
      ...secondaryHeaders,
    ]);
  }, [connection, secondaryConnection]);

  React.useEffect(() => {
    onLog("EnvManager mounted", "info");
    getMcneXML();
    document.body.dataset.agThemeMode = viewModel.theme;
  }, []);

  React.useEffect(() => {
    document.body.dataset.agThemeMode = viewModel.theme;
  }, [viewModel.theme]);

  //Get current settings
  React.useEffect(() => {
    onLog("Loading organization settings...", "info");

    if (connection || secondaryConnection) fetchOrgSettings();
  }, [connection, secondaryConnection, viewModel.blankList.length]);

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
      // console.log(
      //   "defaultOrgSettingsNode:",
      //   defaultOrgSettingsNode.childNodes
      // );
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

            // console.log("Parsed setting:", setting);
            return setting;
          });
        const linkeD365Url = "https://raw.githubusercontent.com/LinkeD365/OrgSettings/master/LinkeD65OrgSettings.xml";
        const linkedD365res = await fetch(linkeD365Url);
        if (!linkedD365res.ok) throw new Error(`Network response was not ok (${linkedD365res.status})`);
        const xmlLD365 = await linkedD365res.text();

        const xmlLD365Doc = parser.parseFromString(xmlLD365, "application/xml");
        // Merge LinkedD365 info into existing fullList by matching names
        const linkedElements = Array.from(xmlLD365Doc.getElementsByTagName("orgSetting")) as Element[];
        console.log("Fetched LinkedD365 XML:", linkedElements);
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

  function setItemNewValue(item: orgProp, newValue: string, secondary?: boolean): void {
    //  console.log("Parent new value for", item.name, "to", newValue);
    runInAction(() => {
      if (secondary) {
        item.secondaryNew = newValue;
      } else {
        item.new = newValue;
      }
    });
  }
  const fetchOrgSettings = async () => {
    if (!connection) {
      console.log;
      ("This should not happen: fetchOrgSettings called without connection");
      window.toolboxAPI.utils.showNotification({
        title: "No active connection 22",
        body: "Please connect to a Dataverse environment to use this tool.",
        type: "error",
        duration: 3000,
      });
      return;
    }

    setLoadingSettings(true);

    //Fetch with primary connection
    await dvService.getOrgSettings().then(async ([orgId, settings]) => {
      console.log("Fetched org settings:", orgId, settings);
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
          // console.log("blank count:", viewModel.blankList.length);
          viewModel.blankList.forEach((f) => {
            //  console.log("Merging setting:", f.name);
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
        console.log("Fetching org settings with secondary connection");
        await dvService.getOrgSettings(true).then(([orgId, secSettings]) => {
          console.log("Fetched org settings:", orgId, secSettings);
          viewModel.secondaryOrgId = orgId;

          const secRows = new Map(secSettings.map((r) => [r.name?.toLowerCase() ?? "", r]));

          runInAction(() => {
            // console.log("blank count:", viewModel.blankList.length);
            viewModel.fullList.forEach((setting) => {
              //  console.log("Merging setting:", f.name);
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
    });
    setLoadingSettings(false);
  };

  function saveOrgSettings(secondary?: boolean): void {
    let editedItems = viewModel.fullList.filter((i) => i.edit);
    if (editedItems.length === 0) {
      window.toolboxAPI.utils.showNotification({
        title: "No changes to save",
        body: "There are no changes to save.",
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
      onLog("No changes to save", "info");
      window.toolboxAPI.utils.showNotification({
        title: "No changes made",
        body: "There are no changes to save.",
      });
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

      window.toolboxAPI.utils.showLoading("Saving organization settings...");
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
        console.log("Update string:", updateString);
        await dvService
          .updateOrgSettingsXml(
            updateString,
            secondary ? viewModel.secondaryOrgId ?? "" : viewModel.primaryOrgId ?? "",
            secondary ?? false
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
        window.toolboxAPI.utils.hideLoading();
      }
    })();
  }

  const saveHeaderButton = observer((params: CustomInnerHeaderProps<orgProp>) => {
    return (
      <div
        className="customInnerHeaderGroup"
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          justifyItems: "flex-end",
        }}
      >
        <div style={{ marginRight: "10px", width: "100%" }}>{params.displayName}</div>
        {viewModel.fullList.filter((op) => op.edit && op.new !== op.current).length > 0 && (
          <Button icon={<Save20Filled />} onClick={() => saveOrgSettings()} />
        )}
      </div>
    );
  });
  const saveHeaderSecondaryButton = observer((params: CustomInnerHeaderProps<orgProp>) => {
    return (
      <div
        className="customInnerHeaderGroup"
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          justifyItems: "flex-end",
        }}
      >
        <div style={{ marginRight: "10px", width: "100%" }}>{params.displayName}</div>
        {viewModel.fullList.filter((op) => op.edit && op.secondaryNew !== op.secondaryCurrent).length > 0 && (
          <Button icon={<Save20Filled />} onClick={() => saveOrgSettings(true)} />
        )}
      </div>
    );
  });

  const cellIcon = observer((params: CustomCellRendererProps<orgProp>) => (
    <div className="imgSpanLogo" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
      {params.data?.edit ? (
        <Button
          icon={<ArrowUndoRegular />}
          onClick={() => params.data && setItemEdit(params.data, !params.data.edit)}
        />
      ) : (
        <Button icon={<EditRegular />} onClick={() => params.data && setItemEdit(params.data, !params.data.edit)} />
      )}
    </div>
  ));

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

  return (
    <div style={{ width: "95vw", height: "98vh" }}>
      <AgGridReact<orgProp> theme={myTheme} rowData={viewModel.fullList} columnDefs={colDefs} domLayout="normal" />
    </div>
  );
});

const cellInfo = observer((params: CustomCellRendererProps<orgProp>) => (
  <div className="imgCellInfo">{params.data && <InfoPopup item={params.data} />}</div>
));
