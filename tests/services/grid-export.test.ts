import { createGrid, type GridApi } from "ag-grid-community";
import { afterEach, describe, expect, it } from "vitest";
import "../../src/components/EnvManager";
import { getDisplayedGridRows } from "../../src/utils/excelExport";

describe("grid export module registration", () => {
  let api: GridApi<{ name: string }> | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    api?.destroy();
    container?.remove();
  });

  it("exports only filtered rows in grid sort order using the real grid API", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const first = { name: "Keep A" };
    const last = { name: "Keep Z" };
    api = createGrid(container, {
      theme: "legacy",
      columnDefs: [
        {
          field: "name",
          filter: "agTextColumnFilter",
          sort: "asc",
          cellDataType: false,
        },
      ],
      rowData: [last, { name: "Exclude B" }, first],
    });

    api.setFilterModel({
      name: { filterType: "text", type: "contains", filter: "Keep" },
    });

    expect(getDisplayedGridRows(api)).toEqual([first, last]);
  });
});
