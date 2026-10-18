import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoliciesGrid } from "../../src/components/PoliciesGrid";
import type { EnvironmentGroupRow } from "../../src/components/EnvironmentGroupsList";
import { EnvMgmt, type EnvGroupRuleRow, type EnvGroupRulesResult } from "../../src/utils/envMgmt";
import { environmentManagement } from "../../src/utils/environmentManagement";
import { deferred } from "../helpers/deferred";

vi.mock("ag-grid-react", () => ({
  AgGridReact: React.forwardRef((props: {
    rowData?: unknown[];
    columnDefs?: Array<{
      children?: Array<{
        headerName?: string;
        headerComponent?: React.ComponentType<{ displayName: string }>;
      }>;
    }>;
  }, _ref) => (
    <div data-testid="policy-grid" data-row-count={props.rowData?.length ?? 0}>
      {props.columnDefs?.flatMap((group) => group.children ?? []).map((column, index) => {
        const Header = column.headerComponent;
        return Header ? <Header key={index} displayName={column.headerName ?? ""} /> : null;
      })}
    </div>
  )),
}));

const connection = {
  id: "connection-1", name: "Reviewed", url: "https://reviewed.crm.dynamics.com",
} as ToolBoxAPI.DataverseConnection;
const group: EnvironmentGroupRow = {
  id: "group-1", environmentGroupId: "group-1", displayName: "Reviewed group",
  description: "", environmentCount: 1, environmentNames: ["Reviewed"], raw: {},
};

function rule(kind: "ruleSet" | "policy", id: string): EnvGroupRuleRow {
  return {
    ruleType: kind, resourceType: "Environment", type: "Test",
    ruleId: id, groupId: "group-1", dataType: "boolean",
    value: { id, value: "boolean", choices: [] },
    shortDescription: id, longDescription: "",
    currentValueString: "false", newValueString: "true",
    edit: true, editable: true,
    updateContext: kind === "ruleSet" ? {
      kind, ruleSetId: id, ruleSet: { parameters: [] },
      parameterType: "Test", resourceType: "Environment", propertyName: id,
    } : {
      kind, policyId: id, policy: { id, ruleSets: [{ inputs: { flag: false } }] },
      ruleSetIndex: 0, inputKey: "flag", currentValue: false,
    },
  };
}

describe("policy save target safety", () => {
  const notify = vi.fn();
  const getConnections = vi.fn();

  beforeEach(() => {
    getConnections.mockResolvedValue([connection]);
    vi.stubGlobal("toolboxAPI", {
      connections: { getConnections }, utils: { showNotification: notify },
    });
    vi.spyOn(environmentManagement, "updateRuleSet").mockResolvedValue({});
    vi.spyOn(environmentManagement, "updateRuleBasedPolicy").mockResolvedValue({});
  });

  async function start(rules: EnvGroupRuleRow[]) {
    const result = { rules, connectors: [] };
    const getRules = vi.spyOn(EnvMgmt.prototype, "getEnvGroupRules").mockResolvedValue(result);
    const props = { groups: [group], connection, showOnlyDifferences: false, onBack: vi.fn() };
    const rendered = render(<PoliciesGrid {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Save policy changes" }));
    const preflight = deferred<EnvGroupRulesResult>();
    getRules.mockReturnValueOnce(preflight.promise);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm and save" }));
    return { result, preflight, rendered, props, getRules };
  }

  for (const kind of ["ruleSet", "policy"] as const) {
    const writer = () => kind === "ruleSet"
      ? environmentManagement.updateRuleSet : environmentManagement.updateRuleBasedPolicy;

    it(`${kind}: writes the reviewed target when it remains current`, async () => {
      const { preflight, result } = await start([rule(kind, "first")]);
      await act(async () => preflight.resolve(result));
      await waitFor(() => expect(writer()).toHaveBeenCalledOnce());
      expect(writer()).toHaveBeenCalledWith("first", expect.any(Object), { connectionTarget: "primary" });
      expect(getConnections).toHaveBeenCalledOnce();
    });

    it(`${kind}: cancels a host connection switch during the fresh read`, async () => {
      const { preflight, result } = await start([rule(kind, "first")]);
      getConnections.mockResolvedValue([{ ...connection, id: "other" }]);
      await act(async () => preflight.resolve(result));
      await waitFor(() => expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Save cancelled" }),
      ));
      expect(writer()).not.toHaveBeenCalled();
    });
  }

  it("rechecks before each request, stopping after a partially applied save", async () => {
    const { preflight, result } = await start([
      rule("ruleSet", "first"), rule("ruleSet", "second"), rule("policy", "third"),
    ]);
    const firstWrite = deferred<PowerPlatformAPI.PowerPlatformResponse>();
    vi.mocked(environmentManagement.updateRuleSet).mockReturnValueOnce(firstWrite.promise);
    await act(async () => preflight.resolve(result));
    await waitFor(() => expect(environmentManagement.updateRuleSet).toHaveBeenCalledOnce());
    getConnections.mockResolvedValue([{ ...connection, id: "other" }]);
    await act(async () => firstWrite.resolve({}));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Save cancelled", body: expect.stringContaining("may already have applied") }),
    ));
    expect(environmentManagement.updateRuleSet).toHaveBeenCalledOnce();
    expect(environmentManagement.updateRuleBasedPolicy).not.toHaveBeenCalled();
    expect(getConnections).toHaveBeenCalledTimes(2);
  });

  it("rechecks the connection before a PATCH after a successful PUT", async () => {
    const { preflight, result } = await start([rule("ruleSet", "first"), rule("policy", "second")]);
    getConnections.mockResolvedValueOnce([connection]).mockResolvedValueOnce([null]);
    await act(async () => preflight.resolve(result));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Save cancelled" }),
    ));
    expect(environmentManagement.updateRuleSet).toHaveBeenCalledOnce();
    expect(environmentManagement.updateRuleBasedPolicy).not.toHaveBeenCalled();
  });

  it("cancels if the selected group changes during preflight", async () => {
    const { preflight, result, rendered, props } = await start([rule("policy", "first")]);
    rendered.rerender(<PoliciesGrid {...props} groups={[{ ...group, environmentGroupId: "other" }]} />);
    await act(async () => preflight.resolve(result));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Save cancelled" }),
    ));
    expect(environmentManagement.updateRuleBasedPolicy).not.toHaveBeenCalled();
  });

  it("cancels when the policy screen unmounts during preflight", async () => {
    const { preflight, result, rendered } = await start([rule("policy", "first")]);
    rendered.unmount();
    await act(async () => preflight.resolve(result));
    expect(environmentManagement.updateRuleBasedPolicy).not.toHaveBeenCalled();
  });

  it("surfaces policy load failures and clears stale rows on a connection change", async () => {
    const getRules = vi.spyOn(EnvMgmt.prototype, "getEnvGroupRules")
      .mockResolvedValueOnce({ rules: [rule("policy", "first")], connectors: [] });
    const props = { groups: [group], connection, showOnlyDifferences: false, onBack: vi.fn() };
    const rendered = render(<PoliciesGrid {...props} />);
    await screen.findByRole("button", { name: "Save policy changes" });
    getRules.mockRejectedValueOnce(new Error("The list has a continuation link"));
    rendered.rerender(<PoliciesGrid {...props} connection={{ ...connection, id: "other" }} />);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Unable to load policies: The list has a continuation link");
    expect(screen.queryByRole("button", { name: "Save policy changes" })).toBeNull();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Unable to load policies" }));
    expect(getRules).toHaveBeenCalledTimes(2);
  });
});
