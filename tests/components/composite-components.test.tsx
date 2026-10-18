import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnvManager } from "../../src/components/EnvManager";
import { PoliciesGrid } from "../../src/components/PoliciesGrid";
import { ViewModel } from "../../src/model/ViewModel";
import type { EnvironmentGroupRow } from "../../src/components/EnvironmentGroupsList";
import type { dvService } from "../../src/utils/dataverse";

vi.mock("../../src/utils/envMgmt", () => ({
  EnvMgmt: class {
    getEnvGroupRules() {
      return Promise.resolve({ rules: [], connectors: [] });
    }
  },
}));

const group: EnvironmentGroupRow = {
  id: "group-1",
  environmentGroupId: "group-1",
  displayName: "Production Group",
  description: "Production environments",
  environmentCount: 1,
  environmentNames: ["Production"],
  raw: {},
};

describe("PoliciesGrid", () => {
  it("loads policy rows and provides navigation back to groups", async () => {
    const onBack = vi.fn();
    render(
      <PoliciesGrid
        groups={[group]}
        connection={{
          id: "connection-1",
          name: "Production",
          url: "https://example.crm.dynamics.com",
        } as ToolBoxAPI.DataverseConnection}
        showOnlyDifferences={false}
        onBack={onBack}
      />,
    );

    expect(screen.getByText("Production Group")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to groups" }));
    expect(onBack).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByTestId("ag-grid")).toBeTruthy());
    expect(screen.getByTestId("ag-grid").getAttribute("data-row-count")).toBe("0");
  });
});

describe("EnvManager", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network unavailable in component test"))),
    );
  });

  it("renders the disconnected state without starting environment writes", async () => {
    const onLog = vi.fn();
    const dvApi = {
      getOrgSettings: vi.fn(),
      updateOrgSettingsXml: vi.fn(),
    };

    render(
      <EnvManager
        connection={null}
        connections={[]}
        isLoading={false}
        viewModel={new ViewModel()}
        dvService={dvApi as unknown as dvService}
        onLog={onLog}
      />,
    );

    expect(await screen.findByText(/No active connection/)).toBeTruthy();
    expect(dvApi.getOrgSettings).not.toHaveBeenCalled();
    expect(dvApi.updateOrgSettingsXml).not.toHaveBeenCalled();
  });
});
