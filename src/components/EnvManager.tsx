import React from "react";
import { observer } from "mobx-react";
import { ViewModel } from "../model/ViewModel";
import {
  ArrowUndoRegular,
  EditRegular,
  Save20Filled,
} from "@fluentui/react-icons";
import {
  DataGrid,
  TableColumnDefinition,
  createTableColumn,
  DataGridHeader,
  DataGridBody,
  DataGridCell,
  DataGridHeaderCell,
  DataGridRow,
  TableRowId,
  DataGridProps,
  Button,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { dvService } from "../utils/dataverse";
import { orgProp } from "../model/OrgSetting";
import { observable, runInAction } from "mobx";
import { InputControl } from "./InputControl";
import { InfoPopup } from "./Info";

const useStyles = makeStyles({
  root: { color: "red", backgroundColor: tokens.colorNeutralBackground1 },
});

interface EnvManagerProps {
  connection: ToolBoxAPI.DataverseConnection | null;
  dvService: dvService;
  isLoading: boolean;
  viewModel: ViewModel;
  onLog: (
    message: string,
    type?: "info" | "success" | "warning" | "error"
  ) => void;
}

function setItemEdit(item: orgProp, edit: boolean) {
  console.log("Setting edit for", item.name, "to", edit);
  runInAction(() => {
    item.edit = edit;
    item.new = item.current;
  });
}

function setItemNewValue(item: orgProp, newValue: string) {
  console.log("Parent new value for", item.name, "to", newValue);
  runInAction(() => {
    item.new = newValue;
    //item.edit = true;
    // // Prefer updating the instance stored in the observable array so MobX reacts to the change
    // const target = viewModel.fullList.find((i) => i.name === item.name);
    // if (target) {
    //   target.new = newValue;
    // } else {
    //   // Fallback: update the provided item
    //   item.new = newValue;
    // }
  });
}

export const EnvManager = observer(
  (props: EnvManagerProps): React.JSX.Element => {
    const { connection, isLoading, viewModel, onLog, dvService } = props;
    const [loadingSettings, setLoadingSettings] = React.useState(false);
    const classes = useStyles();

    const [selectedRows, setSelectedRows] = React.useState(
      new Set<TableRowId>([1])
    );

    React.useEffect(() => {
      onLog("EnvManager mounted", "info");
      getMcneXML();
    }, []);

    //Get current settings
    React.useEffect(() => {
      onLog("Loading organization settings...", "info");

      fetchOrgSettings();
    }, [connection, viewModel.blankList.length]);

    const onSelectionChange: DataGridProps["onSelectionChange"] = (
      _e,
      data
    ) => {
      setSelectedRows(data.selectedItems);
    };

    // Get the Sean Mcne Xml
    const getMcneXML = async () => {
      const url =
        "https://raw.githubusercontent.com/seanmcne/OrgDbOrgSettings/master/mspfedyn_/OrgDbOrgSettings/Solution/WebResources/mspfedyn_/OrgDbOrgSettings/Settings.xml";
      try {
        const res = await fetch(url);
        if (!res.ok)
          throw new Error(`Network response was not ok (${res.status})`);
        const xmlSeanMcNe = await res.text();

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlSeanMcNe, "application/xml");
        const defaultOrgSettingsNode =
          xmlDoc.getElementsByTagName("defaultOrgSettings")[0];
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
                (node as Element).getAttribute("isOrganizationAttribute") ===
                  "false"
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

              console.log("Parsed setting:", setting);
              return setting;
            });
          const linkeD365Url =
            "https://raw.githubusercontent.com/LinkeD365/OrgSettings/master/LinkeD65OrgSettings.xml";
          const linkedD365res = await fetch(linkeD365Url);
          if (!linkedD365res.ok)
            throw new Error(
              `Network response was not ok (${linkedD365res.status})`
            );
          const xmlLD365 = await linkedD365res.text();

          const xmlLD365Doc = parser.parseFromString(
            xmlLD365,
            "application/xml"
          );
          // Merge LinkedD365 info into existing fullList by matching names
          const linkedElements = Array.from(
            xmlLD365Doc.getElementsByTagName("orgSetting")
          ) as Element[];
          console.log("Fetched LinkedD365 XML:", linkedElements);
          runInAction(() => {
            if (!Array.isArray(viewModel.blankList)) return;

            linkedElements.forEach((el) => {
              const name = (el.getAttribute("name") || "").trim();

              const target = viewModel.blankList.find(
                (f) => (f.name || "").toLowerCase() === name.toLowerCase()
              );
              if (target) {
                target.linkeD365Url = el.getAttribute("url") || "";
                target.linkeD365Description =
                  el.getAttribute("description") || "";
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
      if (!connection || !connection.isActive) {
        window.toolboxAPI.utils.showNotification({
          title: "No active connection",
          body: "Please connect to a Dataverse environment to use this tool.",
          type: "error",
          duration: 3000,
        });
        return;
      }

      setLoadingSettings(true);
      await dvService.getOrgSettings().then(([orgId, settings]) => {
        console.log("Fetched org settings:", orgId, settings);
        viewModel.orgId = orgId;
        if (
          Array.isArray(viewModel.blankList) &&
          viewModel.blankList.length > 0 &&
          Array.isArray(settings) &&
          settings.length > 0
        ) {
          const rowMap = new Map(
            settings.map((r) => [r.name?.toLowerCase() ?? "", r])
          );

          runInAction(() => {
            viewModel.fullList = observable([]);
            console.log("blank count:", viewModel.blankList.length);
            viewModel.blankList.forEach((f) => {
              console.log("Merging setting:", f.name);
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
      });
      setLoadingSettings(false);
    };

    function saveOrgSettings(): void {
      const editedItems = viewModel.fullList.filter((i) => i.edit);
      if (editedItems.length === 0) {
        onLog("No changes to save", "info");
        return;
      }

      (async () => {
        if (!connection || !connection.isActive) {
          await window.toolboxAPI.utils.showNotification({
            title: "No active connection",
            body: "Cannot save settings without an active connection.",
            type: "error",
            duration: 3000,
          });
          onLog("No active connection. Cannot save settings.", "error");
          return;
        }

        onLog(
          `Saving ${editedItems.length} organization setting(s)...`,
          "info"
        );
        try {
          let updateString = "<orgSettings>";
          viewModel.fullList
            .filter((it) => it.current || it.new)
            .forEach((it) => {
              updateString += `<${it.name}>${it.new ?? it.current}</${
                it.name
              }>`;
            });
          updateString += "</orgSettings>";

          await dvService
            .updateOrgSettingsXml(updateString, viewModel.orgId)
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
          onLog(`Failed to save org settings: ${String(err)}`, "error");
        }
      })();
    }

    //Columns for the grid displaying org settings
    const columns: TableColumnDefinition<orgProp>[] = [
      createTableColumn<orgProp>({
        columnId: "name",
        compare: (a, b) => {
          return a.name.localeCompare(b.name);
        },
        renderHeaderCell: () => {
          return "Setting Name";
        },
        renderCell: (item) => {
          return (
            <div style={{ verticalAlign: "top" }}>
              {item.name}
              <InfoPopup item={item}></InfoPopup>
            </div>
          );
        },
      }),
      createTableColumn<orgProp>({
        columnId: "current",
        compare: (a, b) => {
          return a.current.localeCompare(b.current);
        },
        renderHeaderCell: () => {
          return "Current Value";
        },
        renderCell: (item) => {
          return <div>{item.current}</div>;
        },
      }),
      createTableColumn<orgProp>({
        columnId: "newValue",
        renderHeaderCell: () => {
          return "New Value";
        },
        renderCell: (item) => {
          return (
            <div>
              <InputControl
                key={item.name}
                // key={item.name}
                item={item}
                setItemNewValue={setItemNewValue}
              />
            </div>
          );
        },
      }),
      // createTableColumn<orgProp>({
      //   columnId: "type",
      //   compare: (a, b) => {
      //     return (a.type || "").localeCompare(b.type || "");
      //   },
      //   renderHeaderCell: () => {
      //     return "Setting Type";
      //   },
      //   renderCell: (item) => {
      //     return <div style={{ verticalAlign: "top" }}>{item.type}</div>;
      //   },
      // }),
      createTableColumn<orgProp>({
        columnId: "Edit",
        renderHeaderCell: () => {
          return viewModel.fullList.some((i) => i.edit) ? (
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              <Button
                icon={<Save20Filled />}
                onClick={() => saveOrgSettings()}
              />
            </div>
          ) : (
            ""
          );
        },
        renderCell: (item) => {
          return (
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              {item.edit ? (
                <Button
                  icon={<ArrowUndoRegular />}
                  onClick={() => setItemEdit(item, !item.edit)}
                ></Button>
              ) : (
                <Button
                  icon={<EditRegular />}
                  onClick={() => setItemEdit(item, !item.edit)}
                ></Button>
              )}
            </div>
          );
        },
      }),
    ];

    const columnSizingOptions = {
      name: {
        minWidth: 80,
        maxWidth: 500,
        defaultWidth: 400,
      },
      current: {
        defaultWidth: 150,
        minWidth: 30,
        idealWidth: 200,
      },
      Edit: {
        defaultWidth: 30,
        minWidth: 30,
        maxWidth: 30,
        idealWidth: 30,
      },
    };

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
      <div>
        {viewModel.fullList && viewModel.fullList.length > 0 ? (
          <div className="info-box">
            {/* <div>{viewModel.fullList.length} settings loaded. test</div> */}
            <DataGrid
              className={classes.root}
              items={viewModel.fullList}
              columns={columns}
              aria-label="Organization Settings"
              sortable
              selectionMode="single"
              selectedItems={selectedRows}
              onSelectionChange={onSelectionChange}
              subtleSelection
              resizableColumns
              columnSizingOptions={columnSizingOptions}
            >
              <DataGridHeader
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  backgroundColor: tokens.colorNeutralBackground2,
                  boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
                }}
              >
                <DataGridRow>
                  {({ renderHeaderCell }) => (
                    <DataGridHeaderCell>
                      {renderHeaderCell()}
                    </DataGridHeaderCell>
                  )}
                </DataGridRow>
              </DataGridHeader>
              <DataGridBody<orgProp>>
                {({ item, rowId }) => (
                  <DataGridRow<orgProp> key={rowId}>
                    {({ renderCell }) => (
                      <DataGridCell>{renderCell(item)}</DataGridCell>
                    )}
                  </DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
            {/* {viewModel.rows.map((row, index) => (
                        <div key={index}>
                            <strong>{row.name}:</strong> {row.current}
                        </div>
                    ))} */}
          </div>
        ) : (
          <div className="info-box">
            <p>No organization settings found.</p>
          </div>
        )}
      </div>
    );
  }
);
