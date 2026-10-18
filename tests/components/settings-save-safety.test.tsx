import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { runInAction } from "mobx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnvManager } from "../../src/components/EnvManager";
import { OrgSettingsGrid } from "../../src/components/OrgSettingsGrid";
import { EnvironmentSettingsGrid } from "../../src/components/EnvironmentSettingsGrid";
import { ViewModel } from "../../src/model/ViewModel";
import { orgProp } from "../../src/model/OrgSetting";
import { dvService } from "../../src/utils/dataverse";
import * as environmentApi from "../../src/utils/environmentManagement";
import { deferred } from "../helpers/deferred";

vi.mock("../../src/components/OrgSettingsGrid", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/components/OrgSettingsGrid")>(),
  OrgSettingsGrid: (props: React.ComponentProps<typeof OrgSettingsGrid>) => (
    <>
      <button onClick={() => runInAction(() => {
        props.rowData[0].edit = true;
        props.setItemNewValue(props.rowData[0], "true");
      })}>Edit organization</button>
      <button onClick={() => props.onSave(0)}>Save organization</button>
    </>
  ),
}));

vi.mock("../../src/components/EnvironmentSettingsGrid", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/components/EnvironmentSettingsGrid")>(),
  EnvironmentSettingsGrid: (props: React.ComponentProps<typeof EnvironmentSettingsGrid>) => (
    <>
      <button onClick={() => {
        props.onToggleEdit("Flag", true);
        props.onNewValueChange("Flag", true, 0);
      }}>Edit environment</button>
      <button onClick={() => props.onSave(0)}>Save environment</button>
      <button onClick={() => props.onNewValueChange("Flag", false, 0)}>Discard environment</button>
    </>
  ),
}));

const connection = {
  id: "connection-1", name: "Reviewed", url: "https://reviewed.crm.dynamics.com",
} as ToolBoxAPI.DataverseConnection;
const replacement = { ...connection, id: "connection-2", name: "Replacement" };

describe("settings save target safety", () => {
  const notify = vi.fn();
  const getConnections = vi.fn();

  beforeEach(() => {
    getConnections.mockResolvedValue([connection]);
    vi.stubGlobal("toolboxAPI", {
      connections: { getConnections },
      utils: { showNotification: notify },
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Metadata offline")));
    vi.spyOn(environmentApi, "getEnvironmentManagementSettings").mockResolvedValue({ Flag: false });
    vi.spyOn(environmentApi, "getEnvironmentGroups").mockResolvedValue({ value: [] });
    vi.spyOn(environmentApi, "getEnvironments").mockResolvedValue({ value: [] });
    vi.spyOn(environmentApi, "updateEnvironmentManagementSettings").mockResolvedValue({});
    vi.spyOn(dvService.prototype, "getEnvironmentId").mockResolvedValue("environment-1");
    const row = new orgProp();
    row.name = "Flag";
    row.current = "false";
    vi.spyOn(dvService.prototype, "getOrgSettings").mockResolvedValue(["org-1", [row]]);
    vi.spyOn(dvService.prototype, "updateOrgSettingsXml").mockResolvedValue({ success: true });
  });

  async function start(kind: "organization" | "environment") {
    const model = new ViewModel();
    const blank = new orgProp();
    blank.name = "Flag";
    model.blankList = [blank];
    const service = new dvService({ connection, dvApi: window.dataverseAPI, onLog: vi.fn() });
    const props = {
      connection, connections: [connection], dvService: service,
      isLoading: false, viewModel: model, onLog: vi.fn(),
    };
    const rendered = render(<EnvManager {...props} />);
    await screen.findByRole("button", { name: "Edit organization" });
    await screen.findByRole("tab", { name: "Environment Settings API" });
    if (kind === "environment") {
      fireEvent.click(screen.getByRole("tab", { name: "Environment Settings API" }));
    }
    fireEvent.click(screen.getByRole("button", { name: `Edit ${kind}` }));
    fireEvent.click(screen.getByRole("button", { name: `Save ${kind}` }));
    await screen.findByRole("button", { name: "Confirm and save" });
    const preflight = deferred<void>();
    if (kind === "organization") {
      vi.mocked(service.getOrgSettings).mockImplementationOnce(async () => {
        await preflight.promise;
        const current = new orgProp();
        current.name = "Flag";
        current.current = "false";
        return ["org-1", [current]];
      });
    } else {
      vi.mocked(environmentApi.getEnvironmentManagementSettings).mockImplementationOnce(async () => {
        await preflight.promise;
        return { Flag: false };
      });
    }
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
    return { preflight, model, rendered, props, service };
  }

  it("populates the editable catalog and clears old values when the organization has no overrides", async () => {
    vi.mocked(dvService.prototype.getOrgSettings).mockResolvedValue(["org-1", []]);
    const model = new ViewModel();
    const blank = new orgProp();
    blank.name = "Flag";
    blank.current = "stale";
    model.blankList = [blank];
    render(<EnvManager
      connection={connection} connections={[connection]} isLoading={false}
      viewModel={model} onLog={vi.fn()}
      dvService={new dvService({ connection, dvApi: window.dataverseAPI, onLog: vi.fn() })}
    />);
    await screen.findByRole("button", { name: "Edit organization" });
    expect(model.fullList).toHaveLength(1);
    expect(model.fullList[0].current).toBe("");
  });

  for (const kind of ["organization", "environment"] as const) {
    const writer = () => kind === "organization"
      ? dvService.prototype.updateOrgSettingsXml
      : environmentApi.updateEnvironmentManagementSettings;

    it(`${kind}: saves when the reviewed target and values remain unchanged`, async () => {
      const { preflight } = await start(kind);
      await act(async () => preflight.resolve());
      await waitFor(() => expect(writer()).toHaveBeenCalledOnce());
      expect(getConnections).toHaveBeenCalledOnce();
      if (kind === "organization") {
        expect(writer()).toHaveBeenCalledWith("<orgSettings><Flag>true</Flag></orgSettings>", "org-1", 0);
      } else {
        expect(writer()).toHaveBeenCalledWith("environment-1", { Flag: true }, { connectionTarget: 0 });
      }
    });

    it(`${kind}: cancels a host-only connection switch during preflight`, async () => {
      const { preflight } = await start(kind);
      getConnections.mockResolvedValue([replacement]);
      await act(async () => preflight.resolve());
      await waitFor(() => expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Save cancelled" }),
      ));
      expect(writer()).not.toHaveBeenCalled();
    });

    it(`${kind}: cancels when pending edits change during preflight`, async () => {
      const { preflight, model } = await start(kind);
      if (kind === "organization") {
        act(() => runInAction(() => { model.fullList[0].new = "different"; }));
      } else {
        fireEvent.click(screen.getByRole("button", { name: "Discard environment" }));
      }
      await act(async () => preflight.resolve());
      await waitFor(() => expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Save cancelled" }),
      ));
      expect(writer()).not.toHaveBeenCalled();
    });

    it(`${kind}: cancels if the screen unmounts during preflight`, async () => {
      const { preflight, rendered } = await start(kind);
      rendered.unmount();
      await act(async () => preflight.resolve());
      expect(writer()).not.toHaveBeenCalled();
    });

    it(`${kind}: cancels when React receives a replacement connection during preflight`, async () => {
      const { preflight, rendered, props } = await start(kind);
      rendered.rerender(<EnvManager {...props} connection={replacement} connections={[replacement]} />);
      await act(async () => preflight.resolve());
      await waitFor(() => expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Save cancelled" }),
      ));
      expect(writer()).not.toHaveBeenCalled();
    });
  }
});
