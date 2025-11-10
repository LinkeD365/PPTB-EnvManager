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
  TableCellLayout,
  DataGridHeader,
  DataGridBody,
  DataGridCell,
  DataGridHeaderCell,
  DataGridRow,
  TableRowId,
  DataGridProps,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  Button,
  Label,
} from "@fluentui/react-components";
import { dvService } from "../utils/dataverse";
import { orgProp } from "../model/OrgSetting";
import { autorun, observable, runInAction } from "mobx";
import { InputControl } from "./InputControl";

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
    autorun(() => {
      console.log(
        "Remaining:",
        viewModel.fullList
          .filter((orgProp) => orgProp.edit)
          .map((orgProp) => orgProp.name)
          .join(", ")
      );
    });
    const { connection, isLoading, viewModel, onLog, dvService } = props;
    //  const [orgSettings, setOrgSettings] = React.useState<any>(null);
    const [loadingSettings, setLoadingSettings] = React.useState(false);
    const [selectedRows, setSelectedRows] = React.useState(
      new Set<TableRowId>([1])
    );
    const onSelectionChange: DataGridProps["onSelectionChange"] = (
      _e,
      data
    ) => {
      setSelectedRows(data.selectedItems);
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
            .filter((it) => it.current)
            .forEach((it) => {
              updateString += `<${it.name}>${it.new ?? it.current}</${
                it.name
              }>`;
            });
          updateString += "</orgSettings>";

          await dvService.updateOrgSettingsXml(updateString, viewModel.orgId);

          // Update local viewModel state after successful save
          runInAction(() => {
            editedItems.forEach((it) => {
              it.current = it.new ?? it.current;
              it.edit = false;
            });
          });

          onLog("Organization settings saved", "success");
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
            <span>
              <Accordion collapsible>
                <AccordionItem value="{item.name}">
                  <AccordionHeader>{item.name}</AccordionHeader>
                  <AccordionPanel>{item.description}</AccordionPanel>
                </AccordionItem>
              </Accordion>
              {/* <details style={{ margin: 0 }}>
                  <summary style={{ cursor: "pointer", listStyle: "none" }}>
                    {item.name}
                  </summary>
                  <div style={{ paddingTop: 8 }}>{item.description}</div>
                </details> */}
            </span>
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
          return <TableCellLayout>{item.current}</TableCellLayout>;
        },
      }),
      createTableColumn<orgProp>({
        columnId: "type",
        compare: (a, b) => {
          return (a.type ?? "").localeCompare(b.type ?? "");
        },
        renderHeaderCell: () => {
          return "Setting Type";
        },
        renderCell: (item) => {
          return <TableCellLayout>{item.type}</TableCellLayout>;
        },
      }),
      createTableColumn<orgProp>({
        columnId: "newValue",
        renderHeaderCell: () => {
          return "New Value";
        },
        renderCell: (item) => {
          return (
              <TableCellLayout>
                {item.new}
                <InputControl key={item.name}
                 // key={item.name}
                  item={item}
                  setItemNewValue={setItemNewValue}
                />
              </TableCellLayout>

          );
        },
      }),
      createTableColumn<orgProp>({
        columnId: "Edit",
        renderHeaderCell: () => {
          return viewModel.fullList.some((i) => i.edit) ? (
            <div
              style={{
                minWidth: 140,
                flexDirection: "row",
                display: "flex",
                justifyContent: "right",
              }}
            >
              <Button
                icon={<Save20Filled />}
                onClick={() => saveOrgSettings()}
              ></Button>
            </div>
          ) : (
            ""
          );
        },
        renderCell: (item) => {
          return (
            <div
              style={{
                minWidth: 140,
                flexDirection: "row",
                display: "flex",
                justifyContent: "right",
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
        maxWidth: 400,
        defaultWidth: 300,
      },
      current: {
        defaultWidth: 100,
        minWidth: 30,
        idealWidth: 80,
      },
    };
    // Get the Sean Mcne Xml
    React.useEffect(() => {
      onLog("EnvManager mounted", "info");
      (async () => {
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
          console.log(
            "defaultOrgSettingsNode:",
            defaultOrgSettingsNode.childNodes
          );
          if (defaultOrgSettingsNode) {
            viewModel.fullList = observable(
              Array.from(defaultOrgSettingsNode.childNodes)
                .filter(
                  (node) =>
                    node.nodeType === 1 &&
                    (node as Element).nodeName === "orgSetting" &&
                    (node as Element).getAttribute(
                      "isOrganizationAttribute"
                    ) === "false"
                )
                .map((node) => {
                  const el = node as Element;

                  const setting = new orgProp();
                  setting.name = el.getAttribute("name") || "";
                  setting.description = el.getAttribute("description") || "";
                  setting.type = el.getAttribute("settingType") || "";
                  setting.min = el.getAttribute("min") || "";
                  setting.max = el.getAttribute("max") || "";
                  setting.maxVersion =
                    el.getAttribute("maxSupportedVersion") || "";
                  setting.minVersion =
                    el.getAttribute("minSupportedVersion") || "";
                  setting.default = el.getAttribute("defaultValue") || "";

                  console.log("Parsed setting:", setting);
                  return setting;
                })
            );
          } else {
            viewModel.fullList = [];
          }
          onLog("Sean McNe XML downloaded", "success");
        } catch (error) {
          onLog(`Failed to download Sean McNe XML: ${String(error)}`, "error");
        }
      })();
    }, []);

    //Get current settings
    React.useEffect(() => {
      onLog("Loading organization settings...", "info");
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
            Array.isArray(viewModel.fullList) &&
            viewModel.fullList.length > 0 &&
            Array.isArray(settings) &&
            settings.length > 0
          ) {
            const rowMap = new Map(
              settings.map((r) => [r.name?.toLowerCase() ?? "", r])
            );

            viewModel.fullList.forEach((f) => {
              const match = rowMap.get(f.name?.toLowerCase() ?? "");
              if (match) {
                // Prefer the value from rows for current if present
                if (match.current && match.current !== "") {
                  f.current = match.current;
                }
              }
            });
          }
        });
        setLoadingSettings(false);
      };

      fetchOrgSettings();
    }, [connection, viewModel.fullList.length]);

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
              items={viewModel.fullList}
              columns={columns}
              aria-label="Organization Settings"
              sortable
              selectionMode="single"
              selectedItems={selectedRows}
              onSelectionChange={onSelectionChange}
              resizableColumns
              columnSizingOptions={columnSizingOptions}
            >
              <DataGridHeader
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  background: "transparent",
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
