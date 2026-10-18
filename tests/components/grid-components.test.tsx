import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ConnectorsGrid,
  createConnectorsSheet,
} from "../../src/components/ConnectorsGrid";
import {
  EnvironmentGroupsList,
  normalizeEnvironmentGroups,
  type EnvironmentGroupRow,
} from "../../src/components/EnvironmentGroupsList";
import {
  EnvironmentSettingsGrid,
  type EnvApiGridRow,
} from "../../src/components/EnvironmentSettingsGrid";
import { OrgSettingsGrid } from "../../src/components/OrgSettingsGrid";
import { orgProp } from "../../src/model/OrgSetting";

const group: EnvironmentGroupRow = {
  id: "group-1",
  environmentGroupId: "group-1",
  displayName: "Production Group",
  description: "Production environments",
  environmentCount: 1,
  environmentNames: ["Production"],
  raw: {},
};

const connector = {
  rowKey: "group-1::policy-1::rules::shared/onedrive",
  environmentGroupId: "group-1",
  policyId: "policy-1",
  policyName: "Connector policy",
  ruleSetId: "rules",
  connectorName: "OneDrive",
  connectorPath: "shared/onedrive",
};

describe("EnvironmentGroupsList", () => {
  const baseProps = {
    isLoading: false,
    error: null,
    isLoaded: false,
    rows: [],
    theme: "legacy" as const,
    onShowPolicies: vi.fn(),
    onCompareSelectedGroups: vi.fn(),
  };

  it("shows loading, error, empty, and unloaded states", () => {
    const { rerender } = render(
      <EnvironmentGroupsList {...baseProps} isLoading />,
    );
    expect(screen.getByText("Loading environment groups from API...")).toBeTruthy();

    rerender(
      <EnvironmentGroupsList
        {...baseProps}
        error="Permission denied"
      />,
    );
    expect(screen.getByText("Permission denied")).toBeTruthy();

    rerender(<EnvironmentGroupsList {...baseProps} isLoaded />);
    expect(
      screen.getByText("No environment groups were returned by the tenant API."),
    ).toBeTruthy();

    rerender(<EnvironmentGroupsList {...baseProps} />);
    expect(screen.getByText("Select the tab to load environment groups.")).toBeTruthy();
  });

  it("renders loaded groups and publishes an export registration", () => {
    const onExportRegistration = vi.fn();
    render(
      <EnvironmentGroupsList
        {...baseProps}
        isLoaded
        rows={[group]}
        onExportRegistration={onExportRegistration}
      />,
    );

    expect(screen.getByTestId("ag-grid").getAttribute("data-row-count")).toBe("1");
    expect(screen.getByText("Production Group")).toBeTruthy();
    expect(onExportRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ id: "environment-groups", rowCount: 1 }),
    );
  });

  it("normalizes API environment group records", () => {
    expect(
      normalizeEnvironmentGroups([
        {
          id: "id-1",
          displayName: "Development",
          description: "Dev",
        },
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "id-1",
          displayName: "Development",
          description: "Dev",
        }),
      ]),
    );
  });
});

describe("ConnectorsGrid", () => {
  it("renders connector rows and exports compared group paths", () => {
    const secondary = {
      ...connector,
      rowKey: "group-2::policy-1::rules::shared/onedrive",
      environmentGroupId: "group-2",
    };
    const onExportRegistration = vi.fn();

    render(
      <ConnectorsGrid
        groups={[group, { ...group, id: "group-2", environmentGroupId: "group-2", displayName: "Test Group" }]}
        connectors={[connector]}
        secondaryConnectors={[secondary]}
        showOnlyDifferences={false}
        theme="legacy"
        onExportRegistration={onExportRegistration}
      />,
    );

    expect(screen.getByTestId("ag-grid").getAttribute("data-row-count")).toBe("1");
    expect(screen.getByText("OneDrive")).toBeTruthy();
    expect(onExportRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ id: "connectors", rowCount: 1 }),
    );
    expect(
      createConnectorsSheet(
        [group, { ...group, displayName: "Test Group" }],
        [connector],
        [secondary],
      ).rows,
    ).toEqual([["OneDrive", "shared/onedrive", "shared/onedrive"]]);
  });
});

describe("EnvironmentSettingsGrid", () => {
  const row: EnvApiGridRow = {
    property: "AllowPublicAccess",
    current: true,
    new: false,
    edit: true,
    valueType: "boolean",
    shortDescription: "Controls public access",
  };

  const baseProps = {
    isLoading: false,
    error: null,
    isLoaded: false,
    rows: [] as EnvApiGridRow[],
    connectionNames: ["Production"],
    showOnlyDifferences: false,
    theme: "legacy" as const,
    savingSlots: [],
    pendingSlots: [],
    onToggleEdit: vi.fn(),
    onNewValueChange: vi.fn(),
    onSave: vi.fn(),
  };

  it("renders loading and API error states", () => {
    const { rerender } = render(
      <EnvironmentSettingsGrid {...baseProps} isLoading />,
    );
    expect(screen.getByText(/Loading environment settings/)).toBeTruthy();

    rerender(
      <EnvironmentSettingsGrid
        {...baseProps}
        error="Access denied"
      />,
    );
    expect(screen.getByText("Access denied")).toBeTruthy();
  });

  it("renders settings and registers export data", () => {
    const onExportRegistration = vi.fn();
    render(
      <EnvironmentSettingsGrid
        {...baseProps}
        isLoaded
        rows={[row]}
        onExportRegistration={onExportRegistration}
      />,
    );

    expect(screen.getByTestId("ag-grid").getAttribute("data-row-count")).toBe("1");
    expect(screen.getByText("AllowPublicAccess")).toBeTruthy();
    expect(onExportRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ id: "environment-settings", rowCount: 1 }),
    );
  });
});

describe("OrgSettingsGrid", () => {
  it("renders settings and shows a host API warning when unavailable", () => {
    const setting = new orgProp();
    setting.name = "AllowEmails";
    setting.current = "true";
    setting.type = "Boolean";
    const onExportRegistration = vi.fn();

    render(
      <OrgSettingsGrid
        rowData={[setting]}
        connectionNames={["Production"]}
        isPowerPlatformApiUnavailable
        showOnlyDifferences={false}
        theme="legacy"
        onSave={vi.fn()}
        setItemNewValue={vi.fn()}
        onExportRegistration={onExportRegistration}
      />,
    );

    expect(screen.getByTestId("ag-grid").getAttribute("data-row-count")).toBe("1");
    expect(screen.getByText("AllowEmails")).toBeTruthy();
    expect(onExportRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ id: "org-settings", rowCount: 1 }),
    );
  });
});
