import { describe, expect, it, vi } from "vitest";
import { assertWriteTarget, WriteTargetChangedError } from "../../src/utils/writeTarget";
import { deferred } from "../helpers/deferred";

const connection = { id: "reviewed" } as ToolBoxAPI.DataverseConnection;

describe("write target guard", () => {
  it("allows an unchanged host slot and local review", async () => {
    const connections = { getConnections: vi.fn().mockResolvedValue([null, connection]) };
    await expect(assertWriteTarget(connections, 1, "reviewed", () => true)).resolves.toBeUndefined();
  });

  it.each([null, { id: "replacement" }])("rejects a changed or removed host connection: %j", async (active) => {
    const connections = { getConnections: vi.fn().mockResolvedValue([active]) };
    await expect(assertWriteTarget(connections, 0, "reviewed", () => true)).rejects.toBeInstanceOf(WriteTargetChangedError);
  });

  it("rechecks local changes after awaiting the host", async () => {
    const host = deferred<Array<ToolBoxAPI.DataverseConnection | null>>();
    const connections = { getConnections: vi.fn(() => host.promise) };
    let current = true;
    const check = assertWriteTarget(connections, 0, "reviewed", () => current);
    current = false;
    host.resolve([connection]);
    await expect(check).rejects.toBeInstanceOf(WriteTargetChangedError);
  });

  it("rejects an invalid local review without contacting the host", async () => {
    const connections = { getConnections: vi.fn() };
    await expect(assertWriteTarget(connections, 0, "reviewed", () => false)).rejects.toBeInstanceOf(WriteTargetChangedError);
    expect(connections.getConnections).not.toHaveBeenCalled();
  });

  it("does not hide failures to verify the host connection", async () => {
    const connections = { getConnections: vi.fn().mockRejectedValue(new Error("Host unavailable")) };
    await expect(assertWriteTarget(connections, 0, "reviewed", () => true)).rejects.toThrow("Host unavailable");
  });
});
