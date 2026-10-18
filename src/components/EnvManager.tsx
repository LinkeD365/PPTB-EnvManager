import React from "react";
import { observer } from "mobx-react";
import { ViewModel } from "../model/ViewModel";
import {
  ModuleRegistry,
  TextFilterModule,
  ClientSideRowModelModule,
  themeQuartz,
} from "ag-grid-community";
import {
  Tab,
  TabList,
  SelectTabData,
  SelectTabEvent,
  Tooltip,
} from "@fluentui/react-components";
import { Info16Regular } from "@fluentui/react-icons";
import { dvService } from "../utils/dataverse";
import {
  orgProp,
  getSlotCurrent,
  getSlotNew,
  setSlotCurrent,
  setSlotNew,
} from "../model/OrgSetting";
import { observable, runInAction } from "mobx";
import {
  createOrgSettingsSheet,
  OrgSettingsGrid,
} from "./OrgSettingsGrid";
import {
  createEnvironmentSettingsSheet,
  EnvironmentSettingsGrid,
  EnvApiGridRow,
  getEnvSlotCurrent,
  getEnvSlotNew,
} from "./EnvironmentSettingsGrid";
import {
  getEnvironmentGroups,
  getEnvironments,
  getEnvironmentManagementSettings,
  updateEnvironmentManagementSettings,
} from "../utils/environmentManagement";
import {
  createEnvironmentGroupsSheet,
  EnvironmentGroupsList,
  EnvironmentGroupRow,
  normalizeEnvironmentGroups,
} from "./EnvironmentGroupsList";
import { PoliciesGrid } from "./PoliciesGrid";
import { ComparisonFilterSwitch } from "./ComparisonFilterButton";
import { ExcelExportButtons } from "./ExcelExportButtons";
import { type GridExportRegistration } from "../utils/excelExport";
import { WriteConfirmationDialog } from "./WriteConfirmationDialog";
import {
  buildOrganizationSettingsXml,
  createWriteConfirmation,
  haveReviewedValues,
  type WriteConfirmation,
} from "../utils/writeConfirmation.mjs";
import envApiInfoFallback from "../data/PPApiInfo.json";
import { assertWriteTarget, WriteTargetChangedError } from "../utils/writeTarget";

interface EnvironmentGroupStats {
  count: number;
  names: string[];
}

interface EnvApiInfoItem {
  apiName: string;
  shortDescription: string;
  link?: string;
}

ModuleRegistry.registerModules([TextFilterModule, ClientSideRowModelModule]);

const myTheme = themeQuartz.withParams({
  headerHeight: "30px",
});

interface EnvManagerProps {
  connection: ToolBoxAPI.DataverseConnection | null;
  connections: Array<ToolBoxAPI.DataverseConnection | null>;
  dvService: dvService;
  isLoading: boolean;
  viewModel: ViewModel;
  onLog: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
}

function getSlotLabel(slot: number): string {
  return slot === 0 ? "primary" : slot === 1 ? "secondary" : `connection ${slot + 1}`;
}

function getConnectionKey(
  connection: ToolBoxAPI.DataverseConnection | null,
): string {
  if (!connection) {
    return "none";
  }

  const c = connection as unknown as {
    id?: string;
    uniqueName?: string;
    name?: string;
  };
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
  value: unknown,
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

  if (
    envSettingTextProperties.has(property) ||
    property.endsWith("Id") ||
    property.endsWith("Url")
  ) {
    return "text";
  }

  // Most EnvironmentManagementSetting flags are booleans, even when null.
  return "boolean";
}

export const EnvManager = observer(
  (props: EnvManagerProps): React.JSX.Element => {
    const {
      connection,
      connections,
      isLoading,
      viewModel,
      onLog,
      dvService,
    } = props;
    const connectionKey = React.useMemo(
      () => getConnectionKey(connection),
      [connection],
    );
    const connectionsKey = React.useMemo(
      () => connections.map(getConnectionKey).join("~"),
      [connections],
    );
    const connectionRef = React.useRef(connection);
    const connectionsRef = React.useRef(connections);
    connectionRef.current = connection;
    connectionsRef.current = connections;
    const mountedRef = React.useRef(false);
    React.useEffect(() => {
      mountedRef.current = true;
      return () => { mountedRef.current = false; };
    }, []);
    const hasOtherConnections = connections.some(
      (conn, slot) => slot > 0 && Boolean(conn),
    );
    const [loadingSettings, setLoadingSettings] = React.useState(false);
    const [pendingWrite, setPendingWrite] = React.useState<{
      confirmation: WriteConfirmation;
      onConfirm: () => void;
    } | null>(null);
    const [selectedTab, setSelectedTab] = React.useState("org-settings");
    const [showOnlyDifferences, setShowOnlyDifferences] = React.useState(false);
    const [isEnvApiLoading, setIsEnvApiLoading] = React.useState(false);
    const [isEnvGroupsLoading, setIsEnvGroupsLoading] = React.useState(false);
    const [envApiSavingSlots, setEnvApiSavingSlots] = React.useState<boolean[]>(
      [],
    );
    const [envApiLoaded, setEnvApiLoaded] = React.useState(false);
    const [envGroupsLoaded, setEnvGroupsLoaded] = React.useState(false);
    const [envApiLoadedSlots, setEnvApiLoadedSlots] = React.useState<boolean[]>(
      [],
    );
    const [envApiError, setEnvApiError] = React.useState<string | null>(null);
    const [envGroupsError, setEnvGroupsError] = React.useState<string | null>(
      null,
    );
    const [envApiRows, setEnvApiRows] = React.useState<EnvApiGridRow[]>([]);
    const [envGroupsRows, setEnvGroupsRows] = React.useState<
      EnvironmentGroupRow[]
    >([]);
    const [envGroupStats, setEnvGroupStats] = React.useState<
      Map<string, EnvironmentGroupStats>
    >(new Map());
    const [envApiEnvironmentIds, setEnvApiEnvironmentIds] = React.useState<
      string[]
    >([]);
    const envApiRowsRef = React.useRef(envApiRows);
    const envApiEnvironmentIdsRef = React.useRef(envApiEnvironmentIds);
    envApiRowsRef.current = envApiRows;
    envApiEnvironmentIdsRef.current = envApiEnvironmentIds;
    const [envApiInfoLookup, setEnvApiInfoLookup] = React.useState<
      Map<string, EnvApiInfoItem>
    >(new Map());
    const envApiInfoLookupRef = React.useRef(envApiInfoLookup);
    const [selectedEnvironmentGroups, setSelectedEnvironmentGroups] =
      React.useState<EnvironmentGroupRow[]>([]);
    const [currentGridExport, setCurrentGridExport] =
      React.useState<GridExportRegistration | null>(null);
    const registerCurrentGridExport = React.useCallback(
      (registration: GridExportRegistration) =>
        setCurrentGridExport((current) =>
          current?.id === registration.id &&
          current.contextKey === registration.contextKey &&
          current.rowCount === registration.rowCount
            ? current
            : registration,
        ),
      [],
    );
    const envGroupStatsRef = React.useRef(envGroupStats);

    function formatGridValue(value: unknown): string | number | boolean | null {
      if (value === null || value === undefined) {
        return null;
      }
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
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
        rows = Object.entries(source as Record<string, unknown>).map(
          ([property, value]) => ({
            property,
            current: formatGridValue(value),
            new: formatGridValue(value),
            edit: false,
            valueType: inferEnvironmentValueType(property, value),
            editable: !(property === "Id" || property === "TenantId"),
          }),
        );
      } else {
        rows = [
          {
            property: "value",
            current: formatGridValue(source),
            new: formatGridValue(source),
            edit: false,
            valueType: "text",
            editable: false,
          },
        ];
      }

      return rows;
    }

    function attachEnvApiInfo(
      rows: EnvApiGridRow[],
      lookup: Map<string, EnvApiInfoItem>,
    ): EnvApiGridRow[] {
      return rows.map((row) => {
        const info = lookup.get(row.property.toLowerCase());
        return {
          ...row,
          shortDescription: info?.shortDescription,
          link: info?.link,
        };
      });
    }

    function mergeOtherEnvApiGrid(
      primaryRows: EnvApiGridRow[],
      slot: number,
      payload: unknown,
    ): EnvApiGridRow[] {
      const otherRows = createEnvApiGrid(payload);
      const otherMap = new Map(otherRows.map((row) => [row.property, row]));

      return primaryRows.map((row) => {
        const otherRow = otherMap.get(row.property);
        const others = [...(row.others ?? [])];
        others[slot] = {
          current: otherRow?.current ?? null,
          new: otherRow?.current ?? null,
        };
        return { ...row, others };
      });
    }

    function getEnvironmentGroupStats(
      payload: unknown,
    ): Map<string, EnvironmentGroupStats> {
      let source: unknown = payload;

      if (source && typeof source === "object") {
        const src = source as { value?: unknown; objectResult?: unknown };
        if (Array.isArray(src.value)) {
          source = src.value;
        } else if (Array.isArray(src.objectResult)) {
          source = src.objectResult;
        }
      }

      const stats = new Map<string, EnvironmentGroupStats>();
      if (!Array.isArray(source)) {
        return stats;
      }

      source.forEach((entry) => {
        if (!entry || typeof entry !== "object") {
          return;
        }

        const environment = entry as Record<string, unknown>;
        const environmentGroupId = String(
          environment.environmentGroupId ?? "",
        ).trim();
        if (!environmentGroupId) {
          return;
        }

        const environmentName = String(
          environment.displayName ?? environment.name ?? environment.id ?? "",
        ).trim();
        const current = stats.get(environmentGroupId) ?? {
          count: 0,
          names: [],
        };

        current.count += 1;
        if (environmentName) {
          current.names.push(environmentName);
        }

        stats.set(environmentGroupId, current);
      });

      stats.forEach((value) => {
        value.names = Array.from(new Set(value.names)).sort((left, right) =>
          left.localeCompare(right),
        );
      });

      return stats;
    }

    function applyEnvironmentGroupCounts(
      rows: EnvironmentGroupRow[],
      stats: Map<string, EnvironmentGroupStats>,
    ): EnvironmentGroupRow[] {
      return rows.map((row) => ({
        ...row,
        environmentCount:
          stats.get(row.environmentGroupId)?.count ??
          stats.get(row.id)?.count ??
          0,
        environmentNames:
          stats.get(row.environmentGroupId)?.names ??
          stats.get(row.id)?.names ??
          [],
      }));
    }

    // Define helper functions before they are used in useEffect
    function setItemNewValue(
      item: orgProp,
      newValue: string,
      slot = 0,
    ): void {
      runInAction(() => {
        setSlotNew(item, slot, newValue);
      });
    }

    React.useEffect(() => {
      setSelectedTab("org-settings");
      setEnvApiLoaded(false);
      setEnvGroupsLoaded(false);
      setEnvApiLoadedSlots([]);
      setEnvApiRows([]);
      setEnvGroupsRows([]);
      setEnvGroupStats(new Map());
      setSelectedEnvironmentGroups([]);
      setEnvApiEnvironmentIds([]);
      setEnvApiError(null);
      setEnvGroupsError(null);
    }, [connectionKey, connectionsKey]);

    React.useEffect(() => {
      envGroupStatsRef.current = envGroupStats;
    }, [envGroupStats]);

    React.useEffect(() => {
      envApiInfoLookupRef.current = envApiInfoLookup;
    }, [envApiInfoLookup]);

    React.useEffect(() => {
      setEnvApiInfoLookup(
        new Map(
          (envApiInfoFallback as EnvApiInfoItem[]).map((item) => [
            item.apiName.trim().toLowerCase(),
            item,
          ]),
        ),
      );
    }, []);

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
          const envId = await dvService.getEnvironmentId(0);
          const envIds: string[] = [envId];
          const loadedSlots: boolean[] = [];
          const response = await getEnvironmentManagementSettings(envId, {
            connectionTarget: 0,
          });
          if (cancelled) {
            return;
          }

          let gridRows = createEnvApiGrid(response);
          for (let slot = 1; slot < connections.length; slot++) {
            if (!connections[slot]) {
              continue;
            }

            try {
              const otherEnvId = await dvService.getEnvironmentId(slot);
              const otherResponse = await getEnvironmentManagementSettings(
                otherEnvId,
                {
                  connectionTarget: slot,
                },
              );
              if (cancelled) {
                return;
              }

              gridRows = mergeOtherEnvApiGrid(gridRows, slot, otherResponse);
              envIds[slot] = otherEnvId;
              loadedSlots[slot] = true;
            } catch (otherErr) {
              onLog(
                `Unable to load ${getSlotLabel(slot)} environment settings: ${String(otherErr)}`,
                "warning",
              );
            }
          }

          setEnvApiEnvironmentIds(envIds);
          setEnvApiLoadedSlots(loadedSlots);

          gridRows = attachEnvApiInfo(gridRows, envApiInfoLookupRef.current);

          setEnvApiRows(gridRows);
          setEnvApiError(null);
          setEnvApiLoaded(true);
          onLog(
            "Environment settings loaded from EnvironmentManagement API",
            "success",
          );
        } catch (err) {
          if (cancelled) {
            return;
          }

          setEnvApiLoaded(false);
          setEnvApiError(String(err));
          onLog(
            `Unable to load environment settings: ${String(err)}`,
            "warning",
          );
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
    }, [connection, connectionKey, connections, dvService, onLog]);

    React.useEffect(() => {
      if (!connection) {
        return;
      }

      let cancelled = false;

      const loadEnvironmentGroups = async () => {
        setIsEnvGroupsLoading(true);
        setEnvGroupsError(null);

        try {
          const response = await getEnvironmentGroups({
            connectionTarget: 0,
          });
          if (cancelled) {
            return;
          }

          const normalizedRows = normalizeEnvironmentGroups(response);
          const currentStats = envGroupStatsRef.current;
          setEnvGroupsRows(
            applyEnvironmentGroupCounts(normalizedRows, currentStats),
          );
          setEnvGroupsLoaded(true);
          onLog(
            "Environment groups loaded from EnvironmentManagement API",
            "success",
          );
        } catch (err) {
          if (cancelled) {
            return;
          }

          setEnvGroupsLoaded(false);
          setEnvGroupsError(String(err));
          onLog(`Unable to load environment groups: ${String(err)}`, "warning");
        } finally {
          if (!cancelled) {
            setIsEnvGroupsLoading(false);
          }
        }
      };

      loadEnvironmentGroups();

      return () => {
        cancelled = true;
      };
    }, [connection, connectionKey, onLog]);

    React.useEffect(() => {
      if (!connection) {
        return;
      }

      let cancelled = false;

      const loadEnvironmentGroupCounts = async () => {
        try {
          const response = await getEnvironments({
            connectionTarget: 0,
          });
          if (cancelled) {
            return;
          }

          const stats = getEnvironmentGroupStats(response);
          setEnvGroupStats(stats);
          setEnvGroupsRows((prev) => applyEnvironmentGroupCounts(prev, stats));
        } catch (err) {
          if (!cancelled) {
            onLog(
              `Unable to load environment counts: ${String(err)}`,
              "warning",
            );
            window.toolboxAPI.utils.showNotification({
              title: "Unable to load environment counts",
              body: String(err),
              type: "warning",
              duration: 5000,
            });
          }
        }
      };

      loadEnvironmentGroupCounts();

      return () => {
        cancelled = true;
      };
    }, [connection, connectionKey, onLog]);

    React.useEffect(() => {
      if (selectedEnvironmentGroups.length === 0) {
        return;
      }

      const selectedIds = new Set(
        envGroupsRows.map((row) => row.environmentGroupId),
      );
      const validSelection = selectedEnvironmentGroups.filter((group) =>
        selectedIds.has(group.environmentGroupId),
      );

      if (validSelection.length !== selectedEnvironmentGroups.length) {
        setSelectedEnvironmentGroups(validSelection);
      }
    }, [envGroupsRows, selectedEnvironmentGroups]);

    React.useEffect(() => {
      if (selectedTab === "environment-groups" && !envGroupsLoaded) {
        setSelectedTab("org-settings");
      }
    }, [selectedTab, envGroupsLoaded]);

    const handleEnvironmentToggleEdit = React.useCallback(
      (property: string, edit: boolean) => {
        setEnvApiRows((prev) =>
          prev.map((row) => {
            if (row.property !== property) {
              return row;
            }

            return {
              ...row,
              edit,
              new: edit ? row.new : row.current,
              others: row.others?.map((other) =>
                other
                  ? { ...other, new: edit ? other.new : other.current }
                  : other,
              ),
            };
          }),
        );
      },
      [],
    );

    const handleEnvironmentNewValueChange = React.useCallback(
      (
        property: string,
        nextValue: string | number | boolean | null,
        slot = 0,
      ) => {
        setEnvApiRows((prev) =>
          prev.map((row) => {
            if (row.property !== property) {
              return row;
            }

            if (slot > 0) {
              const others = [...(row.others ?? [])];
              others[slot] = {
                current: others[slot]?.current ?? null,
                new: nextValue,
              };
              return { ...row, others };
            }

            return { ...row, new: nextValue };
          }),
        );
      },
      [],
    );

    const applyEnvironmentSettingsSave = React.useCallback(
      async (
        slot: number,
        targetEnvironmentId: string,
        expectedConnectionId: string,
        expectedChanges: Array<{
          property: string;
          currentValue: string | number | boolean | null;
          value: string | number | boolean | null;
        }>,
      ) => {
        const targetLabel = getSlotLabel(slot);
        const isCurrent = () => {
          const currentConnection =
            slot === 0 ? connectionRef.current : connectionsRef.current[slot];
          const currentEnvironmentId = envApiEnvironmentIdsRef.current[slot];
          const pendingRows = envApiRowsRef.current.filter(
            (row) => row.edit && row.editable !== false &&
              getEnvSlotNew(row, slot) !== getEnvSlotCurrent(row, slot),
          );
          const changesAreCurrent = pendingRows.length === expectedChanges.length &&
            expectedChanges.every(({ property, currentValue, value }) =>
              pendingRows.some((row) =>
                row.property === property &&
                getEnvSlotCurrent(row, slot) === currentValue &&
                getEnvSlotNew(row, slot) === value,
              ),
            );
          return mountedRef.current &&
            currentConnection?.id === expectedConnectionId &&
            currentEnvironmentId === targetEnvironmentId &&
            changesAreCurrent;
        };

        if (!isCurrent()) {
          window.toolboxAPI.utils.showNotification({
            title: "Save cancelled",
            body: "The connection, environment, or pending changes changed after review. Review the current values and confirm again.",
            type: "warning",
            duration: 5000,
          });
          return;
        }

        const currentRows = envApiRowsRef.current;
        const editedItems = expectedChanges
          .map(({ property }) => currentRows.find((row) => row.property === property))
          .filter((row): row is EnvApiGridRow => Boolean(row));
        setEnvApiSavingSlots((prev) => {
          const next = [...prev];
          next[slot] = true;
          return next;
        });

        try {
          const latestRows = createEnvApiGrid(
            await getEnvironmentManagementSettings(targetEnvironmentId, {
              connectionTarget: slot,
            }),
          );
          const serverValuesMatch = haveReviewedValues(
            expectedChanges.map(({ property, currentValue }) => ({
              key: property,
              currentValue,
            })),
            expectedChanges.map(({ property }) => ({
              key: property,
              currentValue:
                latestRows.find((row) => row.property === property)?.current ??
                null,
            })),
          );
          if (!serverValuesMatch) {
            window.toolboxAPI.utils.showNotification({
              title: "Save cancelled",
              body: "One or more environment settings changed in the environment after review. Reload the values, review the latest state, and confirm again.",
              type: "warning",
              duration: 6000,
            });
            return;
          }

          const payload = Object.fromEntries(
            expectedChanges.map(({ property, value }) => [property, value]),
          );

          await assertWriteTarget(
            window.toolboxAPI.connections, slot, expectedConnectionId, isCurrent,
          );
          const response = await updateEnvironmentManagementSettings(
            targetEnvironmentId,
            payload,
            {
              connectionTarget: slot,
            },
          );
          const responseObj = response as {
            errors?: { message?: string } | null;
            responseMessage?: string;
          };

          if (responseObj.errors || responseObj.responseMessage) {
            const errorMessage =
              responseObj.errors?.message ??
              responseObj.responseMessage ??
              "Unknown API error";
            throw new Error(errorMessage);
          }

          setEnvApiRows((prev) =>
            prev.map((row) => {
              const updatedValue = payload[row.property];
              if (updatedValue === undefined) {
                return row;
              }

              let updatedRow: EnvApiGridRow;
              if (slot > 0) {
                const others = [...(row.others ?? [])];
                const newValue = others[slot]?.new;
                others[slot] = {
                  current: updatedValue,
                  new: newValue === undefined ? updatedValue : newValue,
                };
                updatedRow = { ...row, others };
              } else {
                updatedRow = {
                  ...row,
                  current: updatedValue,
                  new: row.new === undefined ? updatedValue : row.new,
                };
              }

              return {
                ...updatedRow,
                edit:
                  updatedRow.new !== updatedRow.current ||
                  updatedRow.others?.some(
                    (other) => other && other.new !== other.current,
                  ) === true,
              };
            }),
          );
          onLog(
            `Updated ${editedItems.length} ${targetLabel} environment setting(s) successfully`,
            "success",
          );
          window.toolboxAPI.utils.showNotification({
            title: "Environment settings updated",
            body: `Saved ${editedItems.length} ${slot > 0 ? `${targetLabel} ` : ""}setting(s).`,
            type: "success",
            duration: 3000,
          });
        } catch (err) {
          if (err instanceof WriteTargetChangedError) {
            window.toolboxAPI.utils.showNotification({
              title: "Save cancelled", body: err.message, type: "warning", duration: 6000,
            });
            return;
          }
          const message = String(err);
          onLog(
            `Failed to update ${targetLabel} environment settings: ${message}`,
            "error",
          );
          window.toolboxAPI.utils.showNotification({
            title: `Failed to update ${targetLabel} environment settings`,
            body: message,
            type: "error",
            duration: 4000,
          });
        } finally {
          setEnvApiSavingSlots((prev) => {
            const next = [...prev];
            next[slot] = false;
            return next;
          });
        }
      },
      [connection, connections, envApiEnvironmentIds, envApiRows, onLog],
    );

    const saveEnvironmentSettings = React.useCallback(
      (slot = 0) => {
        const targetLabel = getSlotLabel(slot);
        const targetEnvironmentId = envApiEnvironmentIds[slot];

        if (!targetEnvironmentId) {
          onLog(
            `Cannot save ${targetLabel} environment settings: environment id is missing`,
            "error",
          );
          return;
        }

        const editedItems = envApiRows.filter(
          (row) =>
            row.edit &&
            row.editable !== false &&
            getEnvSlotNew(row, slot) !== getEnvSlotCurrent(row, slot),
        );

        if (editedItems.length === 0) {
          window.toolboxAPI.utils.showNotification({
            title: "No changes to save",
            body:
              slot > 0
                ? `No ${targetLabel} environment settings have been modified.`
                : "No environment settings have been modified.",
          });
          return;
        }

        const targetConnection = slot === 0 ? connection : connections[slot];
        if (!targetConnection) {
          window.toolboxAPI.utils.showNotification({
            title: "Save cancelled",
            body: "The selected connection is no longer available.",
            type: "error",
          });
          return;
        }

        const expectedChanges = editedItems.map((row) => ({
          property: row.property,
          currentValue: getEnvSlotCurrent(row, slot) ?? null,
          value: getEnvSlotNew(row, slot) ?? null,
        }));
        const changeConfirmation = createWriteConfirmation(
          "environment settings",
          `${targetConnection.name} (${targetConnection.url})`,
          expectedChanges.map(({ property, value }) => {
            const row = envApiRows.find((item) => item.property === property);
            const currentValue = row
              ? getEnvSlotCurrent(row, slot)
              : undefined;
            const describe = (settingValue: unknown): string =>
              settingValue === null || settingValue === undefined
                ? "(not set)"
                : settingValue === ""
                  ? "(empty)"
                  : String(settingValue);
            return `${property}: ${describe(currentValue)} → ${describe(value)}`;
          }),
        );

        setPendingWrite({
          confirmation: changeConfirmation,
          onConfirm: () =>
            void applyEnvironmentSettingsSave(
              slot,
              targetEnvironmentId,
              targetConnection.id,
              expectedChanges,
            ),
        });
      },
      [
        applyEnvironmentSettingsSave,
        connection,
        connections,
        envApiEnvironmentIds,
        envApiRows,
        onLog,
      ],
    );

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

      if (connection || hasOtherConnections) fetchOrgSettings();
    }, [connection, connections, viewModel.blankList.length, onLog]);

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
        if (defaultOrgSettingsNode) {
          viewModel.blankList = Array.from(defaultOrgSettingsNode.childNodes)
            .filter(
              (node) =>
                node.nodeType === 1 &&
                (node as Element).nodeName === "orgSetting" &&
                (node as Element).getAttribute("isOrganizationAttribute") ===
                  "false",
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
          const linkeD365Url =
            "https://raw.githubusercontent.com/LinkeD365/OrgSettings/master/LinkeD65OrgSettings.xml";
          const linkedD365res = await fetch(linkeD365Url);
          if (!linkedD365res.ok)
            throw new Error(
              `Network response was not ok (${linkedD365res.status})`,
            );
          const xmlLD365 = await linkedD365res.text();

          const xmlLD365Doc = parser.parseFromString(
            xmlLD365,
            "application/xml",
          );
          // Merge LinkedD365 info into existing fullList by matching names
          const linkedElements = Array.from(
            xmlLD365Doc.getElementsByTagName("orgSetting"),
          ) as Element[];
          runInAction(() => {
            if (!Array.isArray(viewModel.blankList)) return;

            linkedElements.forEach((el) => {
              const name = (el.getAttribute("name") || "").trim();

              const target = viewModel.blankList.find(
                (f) => (f.name || "").toLowerCase() === name.toLowerCase(),
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
          viewModel.orgIds = [orgId];
          if (
            Array.isArray(viewModel.blankList) &&
            viewModel.blankList.length > 0 &&
            Array.isArray(settings)
          ) {
            const rowMap = new Map(
              settings.map((r) => [r.name?.toLowerCase() ?? "", r]),
            );

            runInAction(() => {
              viewModel.fullList = observable([]);
              viewModel.blankList.forEach((f) => {
                const match = rowMap.get(f.name?.toLowerCase() ?? "");
                setSlotCurrent(f, 0, match?.current);
                viewModel.fullList.push(f);
              });
            });
          }

          runInAction(() => {
            viewModel.orgIds = [orgId];
            viewModel.fullList.forEach((setting) => {
              setting.others = [];
              setting.edit = false;
              setting.new = undefined;
            });
          });

          for (let slot = 1; slot < connections.length; slot++) {
            if (!connections[slot]) {
              continue;
            }

            try {
              const [otherOrgId, otherSettings] =
                await dvService.getOrgSettings(slot);
              const otherRows = new Map(
                otherSettings.map((r) => [r.name?.toLowerCase() ?? "", r]),
              );

              runInAction(() => {
                viewModel.orgIds[slot] = otherOrgId;
                viewModel.fullList.forEach((setting) => {
                  const match = otherRows.get(
                    setting.name?.toLowerCase() ?? "",
                  );
                  // Prefer the value from rows for current if present
                  if (match) {
                    setSlotCurrent(setting, slot, match.current);
                  }
                });
              });
            } catch (otherErr) {
              onLog(
                `Failed to fetch ${getSlotLabel(slot)} organization settings: ${String(otherErr)}`,
                "error",
              );
              window.toolboxAPI.utils.showNotification({
                title: "Error fetching organization settings",
                body: `Error: ${String(otherErr)}`,
                type: "error",
                duration: 3000,
              });
            }
          }
        })
        .catch((err) => {
          onLog(
            `Failed to fetch organization settings: ${String(err)}`,
            "error",
          );
          window.toolboxAPI.utils.showNotification({
            title: "Error fetching organization settings",
            body: `Error: ${String(err)}`,
            type: "error",
            duration: 3000,
          });
        });
      setLoadingSettings(false);
    };

    async function applyOrgSettingsSave(
      slot: number,
      expectedConnectionId: string,
      expectedOrgId: string,
      expectedValues: Array<{
        item: orgProp;
        name: string;
        currentValue: string | undefined;
        value: string;
      }>,
    ): Promise<void> {
      const isCurrent = () => {
        const pendingRows = viewModel.fullList.filter(
          (item) => item.edit &&
            getSlotNew(item, slot) !== getSlotCurrent(item, slot),
        );
        const currentValuesMatch = pendingRows.length === expectedValues.length &&
          expectedValues.every(
            ({ item, name, currentValue, value }) =>
              pendingRows.includes(item) &&
              item.name === name &&
              getSlotCurrent(item, slot) === currentValue &&
              getSlotNew(item, slot) === value,
          );
        return mountedRef.current &&
          (slot === 0 ? connectionRef.current : connectionsRef.current[slot])
            ?.id === expectedConnectionId &&
          viewModel.orgIds[slot] === expectedOrgId &&
          currentValuesMatch;
      };
      if (!isCurrent()) {
        window.toolboxAPI.utils.showNotification({
          title: "Save cancelled",
          body: "The connection, organization, or pending changes changed after review. Review the current values and confirm again.",
          type: "warning",
          duration: 5000,
        });
        return;
      }

      const savedValues = new Map<orgProp, string>(
        expectedValues.map(({ item, value }) => [item, value]),
      );
      window.toolboxAPI.utils.showNotification({
        title: "Saving organization settings...",
        body: `Saving ${expectedValues.length} organization setting(s)...`,
        type: "info",
        duration: 3000,
      });
      onLog(
        `Saving ${expectedValues.length} organization setting(s)...`,
        "info",
      );
      try {
        const [latestOrgId, latestSettings] = await dvService.getOrgSettings(slot);
        if (latestOrgId !== expectedOrgId) {
          window.toolboxAPI.utils.showNotification({
            title: "Save cancelled",
            body: "The organization changed after review. Reload the values and confirm the save again.",
            type: "warning",
            duration: 6000,
          });
          return;
        }

        const latestByName = new Map(
          latestSettings.map((setting) => [
            setting.name.toLowerCase(),
            { name: setting.name, value: setting.current },
          ]),
        );
        const serverValuesMatch = haveReviewedValues(
          expectedValues.map(({ name, currentValue }) => ({
            key: name.toLowerCase(),
            currentValue: currentValue ?? "",
          })),
          expectedValues.map(({ name }) => ({
            key: name.toLowerCase(),
            currentValue: latestByName.get(name.toLowerCase())?.value ?? "",
          })),
        );
        if (!serverValuesMatch) {
          window.toolboxAPI.utils.showNotification({
            title: "Save cancelled",
            body: "One or more organization settings changed in Dataverse after review. Reload the values, review the latest state, and confirm again.",
            type: "warning",
            duration: 6000,
          });
          return;
        }

        for (const { name, value } of expectedValues) {
          const key = name.toLowerCase();
          latestByName.set(key, {
            name: latestByName.get(key)?.name ?? name,
            value,
          });
        }
        const updateString = buildOrganizationSettingsXml(
          Array.from(latestByName.values()),
        );
        await assertWriteTarget(
          window.toolboxAPI.connections, slot, expectedConnectionId, isCurrent,
        );
        const result = await dvService.updateOrgSettingsXml(
          updateString,
          expectedOrgId,
          slot,
        );
        if (!result.success) {
          throw new Error(result.error);
        }

        await window.toolboxAPI.utils.showNotification({
          title: "Organization Settings Saved",
          body: "The organization settings have been successfully saved.",
        });

        runInAction(() => {
          savedValues.forEach((savedValue, item) => {
            setSlotCurrent(item, slot, savedValue);
            item.edit = connections.some(
              (_, pendingSlot) =>
                getSlotNew(item, pendingSlot) !==
                getSlotCurrent(item, pendingSlot),
            );
          });
        });

        onLog("Organization settings saved", "success");
      } catch (err) {
        if (err instanceof WriteTargetChangedError) {
          window.toolboxAPI.utils.showNotification({
            title: "Save cancelled", body: err.message, type: "warning", duration: 6000,
          });
          return;
        }
        await window.toolboxAPI.utils.showNotification({
          title: "Failed to save organization settings",
          body: `Error: ${String(err)}`,
          type: "error",
          duration: 3000,
        });
        onLog(`Failed to save org settings: ${String(err)}`, "error");
      }
    }

    function saveOrgSettings(slot = 0): void {
      const editedItems = viewModel.fullList.filter(
        (item) =>
          item.edit &&
          getSlotNew(item, slot) !== getSlotCurrent(item, slot),
      );
      if (editedItems.length === 0) {
        window.toolboxAPI.utils.showNotification({
          title: "No changes to save",
          body: "No organization settings have been modified.",
        });
        onLog("No changes to save", "info");
        return;
      }

      const conn = slot === 0 ? connection : connections[slot];
      const orgId = viewModel.orgIds[slot];
      if (!conn || !orgId) {
        window.toolboxAPI.utils.showNotification({
          title: "Cannot confirm save",
          body: "The selected connection or organization could not be identified.",
          type: "error",
        });
        onLog("Cannot confirm organization settings save: missing target", "error");
        return;
      }

      const expectedValues = editedItems.map((item) => ({
        item,
        name: item.name,
        currentValue: getSlotCurrent(item, slot),
        value: getSlotNew(item, slot) ?? getSlotCurrent(item, slot) ?? "",
      }));
      const changeConfirmation = createWriteConfirmation(
        "organization settings",
        `${conn.name} (${conn.url})`,
        expectedValues.map(({ name, currentValue, value }) => {
          const describe = (settingValue: string | undefined): string =>
            settingValue === undefined ? "(not set)" : settingValue === "" ? "(empty)" : settingValue;
          return `${name}: ${describe(currentValue)} → ${describe(value)}`;
        }),
      );

      setPendingWrite({
        confirmation: changeConfirmation,
        onConfirm: () =>
          void applyOrgSettingsSave(
            slot,
            conn.id,
            orgId,
            expectedValues,
          ),
      });
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

    const showTabs =
      envApiLoaded ||
      envGroupsLoaded ||
      Boolean(envApiError) ||
      Boolean(envGroupsError);
    const canShowEnvironmentGroupsTab = envGroupsLoaded;
    const canFilterDifferences =
      (selectedTab === "org-settings" && hasOtherConnections) ||
      (selectedTab === "environment-settings" &&
        envApiLoadedSlots.some(Boolean)) ||
      (selectedTab === "environment-groups" &&
        selectedEnvironmentGroups.length === 2);
    const registeredCurrentExport =
      currentGridExport?.id === selectedTab ? currentGridExport : undefined;
    const orgConnectionNames = connections.map((conn) => conn?.name);
    orgConnectionNames[0] = connection.name;
    const envConnectionNames = connections.map((conn, slot) =>
      slot === 0 || envApiLoadedSlots[slot] ? conn?.name : undefined,
    );
    envConnectionNames[0] = connection.name;
    const envPendingSlots = envConnectionNames.map((_, slot) =>
      envApiRows.some(
        (row) =>
          row.edit &&
          getEnvSlotNew(row, slot) !== getEnvSlotCurrent(row, slot) &&
          row.editable !== false,
      ),
    );
    const envSavingSlots = envConnectionNames.map(
      (_, slot) => envApiSavingSlots[slot] ?? false,
    );
    const organizationSettingsSheet = createOrgSettingsSheet(
      viewModel.fullList,
      orgConnectionNames,
      showOnlyDifferences,
    );
    const environmentSettingsSheet = createEnvironmentSettingsSheet(
      envApiRows,
      envConnectionNames,
      showOnlyDifferences,
    );
    const environmentGroupsSheet =
      createEnvironmentGroupsSheet(envGroupsRows);
    const currentExport =
      selectedTab === "environment-settings"
        ? {
            label: "Export Environment Settings",
            fileName: `environment-settings-${connection.name}`,
            disabled: envApiRows.length === 0,
            getSheets: () =>
              registeredCurrentExport
                ? [registeredCurrentExport.getSheet()]
                : [environmentSettingsSheet],
          }
        : selectedTab === "environment-groups"
          ? {
              label: "Export Environment Groups",
              fileName: "environment-groups",
              disabled: envGroupsRows.length === 0,
              getSheets: () =>
                registeredCurrentExport
                  ? [registeredCurrentExport.getSheet()]
                  : [environmentGroupsSheet],
            }
          : {
              label: "Export Organization Settings",
              fileName: `organization-settings-${connection.name}`,
              disabled: viewModel.fullList.length === 0,
              getSheets: () =>
                registeredCurrentExport
                  ? [registeredCurrentExport.getSheet()]
                  : [organizationSettingsSheet],
            };
    const availableExportCount =
      1 + Number(envApiLoaded) + Number(envGroupsLoaded);
    const allExportDisabled =
      viewModel.fullList.length === 0 &&
      (!envApiLoaded || envApiRows.length === 0) &&
      (!envGroupsLoaded || envGroupsRows.length === 0);

    return (
      <>
        <WriteConfirmationDialog
          confirmation={pendingWrite?.confirmation ?? null}
          onCancel={() => setPendingWrite(null)}
          onConfirm={() => {
            const confirmedWrite = pendingWrite;
            setPendingWrite(null);
            confirmedWrite?.onConfirm();
          }}
        />
        <div
          style={{
            width: "100%",
            height: "98vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            marginTop: "8px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {showTabs && (
              <TabList
                selectedValue={selectedTab}
                onTabSelect={(_event: SelectTabEvent, data: SelectTabData) =>
                  setSelectedTab(String(data.value))
                }
                size="small"
                style={{ flex: 1, minWidth: 0 }}
              >
                <Tab value="org-settings">Organization Settings</Tab>
                <Tab value="environment-settings">Environment Settings API</Tab>
                {canShowEnvironmentGroupsTab && (
                  <Tab value="environment-groups">Environment Groups</Tab>
                )}
                {!canShowEnvironmentGroupsTab && envGroupsError && (
                  <Tooltip
                    content="To enable the Environment Groups grid, you need to enable Power Platform API access."
                    relationship="description"
                  >
                    <span
                      tabIndex={0}
                      aria-label="Environment Groups unavailable"
                      role="img"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "2px 4px",
                      }}
                    >
                      <Info16Regular />
                    </span>
                  </Tooltip>
                )}
              </TabList>
            )}
            {!showTabs && <div style={{ flex: 1 }} />}
            {showTabs && canFilterDifferences && (
              <ComparisonFilterSwitch
                showOnlyDifferences={showOnlyDifferences}
                onChange={setShowOnlyDifferences}
              />
            )}
            {selectedEnvironmentGroups.length === 0 && (
              <ExcelExportButtons
                fileName={currentExport.fileName}
                currentLabel={currentExport.label}
                disabled={currentExport.disabled}
                allDisabled={allExportDisabled}
                getCurrentSheets={currentExport.getSheets}
                getAllSheets={
                  availableExportCount > 1
                    ? () => [
                        organizationSettingsSheet,
                        ...(envApiLoaded ? [environmentSettingsSheet] : []),
                        ...(envGroupsLoaded ? [environmentGroupsSheet] : []),
                      ]
                    : undefined
                }
              />
            )}
          </div>

          <div
            className="env-manager-tab-content"
            style={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              overflow: "hidden",
              marginTop: showTabs ? "8px" : "0",
            }}
          >
            {(!showTabs || selectedTab === "org-settings") && (
              <OrgSettingsGrid
                theme={myTheme}
                rowData={viewModel.fullList}
                connectionNames={orgConnectionNames}
                isPowerPlatformApiUnavailable={Boolean(envApiError)}
                showOnlyDifferences={showOnlyDifferences}
                onSave={saveOrgSettings}
                setItemNewValue={setItemNewValue}
                onExportRegistration={registerCurrentGridExport}
              />
            )}

            {showTabs && selectedTab === "environment-settings" && (
              <EnvironmentSettingsGrid
                isLoading={isEnvApiLoading}
                error={envApiError}
                isLoaded={envApiLoaded}
                rows={envApiRows}
                connectionNames={envConnectionNames}
                showOnlyDifferences={showOnlyDifferences}
                savingSlots={envSavingSlots}
                pendingSlots={envPendingSlots}
                onToggleEdit={handleEnvironmentToggleEdit}
                onNewValueChange={handleEnvironmentNewValueChange}
                onSave={(slot) => {
                  void saveEnvironmentSettings(slot);
                }}
                theme={myTheme}
                onExportRegistration={registerCurrentGridExport}
              />
            )}

            {showTabs &&
              selectedTab === "environment-groups" &&
              (selectedEnvironmentGroups.length > 0 ? (
                <PoliciesGrid
                  groups={selectedEnvironmentGroups}
                  connection={connection}
                  theme={myTheme}
                  showOnlyDifferences={showOnlyDifferences}
                  onBack={() => setSelectedEnvironmentGroups([])}
                />
              ) : (
                <EnvironmentGroupsList
                  isLoading={isEnvGroupsLoading}
                  error={envGroupsError}
                  isLoaded={envGroupsLoaded}
                  rows={envGroupsRows}
                  theme={myTheme}
                  onShowPolicies={(row) => setSelectedEnvironmentGroups([row])}
                  onCompareSelectedGroups={(rows) =>
                    setSelectedEnvironmentGroups(rows)
                  }
                  onExportRegistration={registerCurrentGridExport}
                />
              ))}
          </div>
        </div>
        </div>
      </>
    );
  },
);
