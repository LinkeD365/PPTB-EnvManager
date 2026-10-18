import { beforeEach, describe, expect, it, vi } from "vitest";
import { dvService } from "../../src/utils/dataverse";
import { buildOrganizationSettingsXml } from "../../src/utils/writeConfirmation.mjs";

describe("organization settings XML reads", () => {
  const fetchXmlQuery = vi.fn<DataverseAPI.API["fetchXmlQuery"]>();
  const onLog = vi.fn();
  let service: dvService;

  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal("dataverseAPI", { fetchXmlQuery });
    service = new dvService({
      connection: { id: "connection-1" } as ToolBoxAPI.DataverseConnection,
      dvApi: window.dataverseAPI,
      onLog,
    });
  });

  function respond(xml: string | null | undefined) {
    fetchXmlQuery.mockResolvedValue({
      value: [{ organizationid: "org-1", orgdborgsettings: xml }],
    });
  }

  it.each([null, undefined, "", " \n "])("treats %j as no settings", async (xml) => {
    respond(xml);
    expect(await service.getOrgSettings()).toEqual(["org-1", []]);
    expect(fetchXmlQuery).toHaveBeenCalledWith(expect.any(String), 0);
  });

  it.each(["orgSettings", "OrgSettings"])("reads %s and round-trips decoded text values", async (root) => {
    respond(`<${root}>
      <!-- Keep the setting values, not formatting nodes -->
      <Flag>true</Flag>
      <Empty />
      <Text>A &amp; B &lt; C</Text>
    </${root}>`);
    const [id, rows] = await service.getOrgSettings();
    expect(id).toBe("org-1");
    expect(rows.map(({ name, current }) => ({ name, current }))).toEqual([
      { name: "Flag", current: "true" },
      { name: "Empty", current: "" },
      { name: "Text", current: "A & B < C" },
    ]);
    expect(buildOrganizationSettingsXml(rows.map(({ name, current }) => ({
      name, value: current ?? "",
    })))).toBe("<orgSettings><Flag>true</Flag><Empty></Empty><Text>A &amp; B &lt; C</Text></orgSettings>");
  });

  it.each(["orgSettings", "OrgSettings"])("accepts an empty %s root", async (root) => {
    respond(`<${root} />`);
    expect(await service.getOrgSettings()).toEqual(["org-1", []]);
  });

  it.each([
    "<orgSettings><Flag>true</Flag></orgSettings>",
    "<OrgSettings><Flag>true</Flag></OrgSettings>",
    "<orgSettings><Flag></orgSettings>",
  ])("logs the returned XML before validating it: %s", async (xml) => {
    respond(xml);
    if (xml.includes("<Flag>true</Flag>")) {
      await service.getOrgSettings();
    } else {
      await expect(service.getOrgSettings()).rejects.toThrow();
    }

    const diagnostic = `Organization settings XML received (slot 0, connection connection-1, organization org-1):\n${xml}`;
    expect(onLog).toHaveBeenCalledWith(diagnostic, "info");
    expect(console.info).toHaveBeenCalledWith(diagnostic);
  });

  it.each([
    "<orgSettings><Flag></orgSettings>",
    "<unrelated><Flag>true</Flag></unrelated>",
    "<orgSettings><Flag><Nested /></Flag></orgSettings>",
    '<orgSettings><Flag custom="value">true</Flag></orgSettings>',
    "<OrgSettings><Flag><Nested /></Flag></OrgSettings>",
    '<OrgSettings><Flag custom="value">true</Flag></OrgSettings>',
  ])("rejects XML that cannot safely be round-tripped: %s", async (xml) => {
    respond(xml);
    await expect(service.getOrgSettings()).rejects.toThrow();
  });

  it("surfaces query failures", async () => {
    fetchXmlQuery.mockRejectedValue(new Error("Access denied"));
    await expect(service.getOrgSettings()).rejects.toThrow("Access denied");
  });
});
