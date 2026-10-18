import { beforeEach, describe, expect, it, vi } from "vitest";
import { dvService } from "../../src/utils/dataverse";
import { buildOrganizationSettingsXml } from "../../src/utils/writeConfirmation.mjs";

describe("organization settings XML reads", () => {
  const fetchXmlQuery = vi.fn<DataverseAPI.API["fetchXmlQuery"]>();
  let service: dvService;

  beforeEach(() => {
    vi.stubGlobal("dataverseAPI", { fetchXmlQuery });
    service = new dvService({
      connection: { id: "connection-1" } as ToolBoxAPI.DataverseConnection,
      dvApi: window.dataverseAPI,
      onLog: vi.fn(),
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

  it("ignores whitespace and comments and round-trips decoded text values", async () => {
    respond(`<orgSettings>
      <!-- Keep the setting values, not formatting nodes -->
      <Flag>true</Flag>
      <Empty />
      <Text>A &amp; B &lt; C</Text>
    </orgSettings>`);
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

  it("accepts an empty orgSettings root", async () => {
    respond("<orgSettings />");
    expect(await service.getOrgSettings()).toEqual(["org-1", []]);
  });

  it.each([
    "<orgSettings><Flag></orgSettings>",
    "<unrelated><Flag>true</Flag></unrelated>",
    "<orgSettings><Flag><Nested /></Flag></orgSettings>",
    '<orgSettings><Flag custom="value">true</Flag></orgSettings>',
  ])("rejects XML that cannot safely be round-tripped: %s", async (xml) => {
    respond(xml);
    await expect(service.getOrgSettings()).rejects.toThrow();
  });

  it("surfaces query failures", async () => {
    fetchXmlQuery.mockRejectedValue(new Error("Access denied"));
    await expect(service.getOrgSettings()).rejects.toThrow("Access denied");
  });
});
