import React from "react";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("ag-grid-react", () => {
  const Grid = React.forwardRef<
    { api: Record<string, unknown> },
    {
      rowData?: Array<Record<string, unknown>>;
      onGridReady?: (event: { api: Record<string, unknown> }) => void;
      [key: string]: unknown;
    }
  >((props, ref) => {
    const rowData = props.rowData ?? [];
    const api = React.useMemo(
      () => ({
        forEachNodeAfterFilterAndSort: (
          callback: (node: { data: Record<string, unknown> }) => void,
        ) => rowData.forEach((data) => callback({ data })),
        getSelectedNodes: () => [],
        getSelectedRows: () => [],
      }),
      [rowData],
    );

    React.useImperativeHandle(ref, () => ({ api }), [api]);
    React.useEffect(() => {
      props.onGridReady?.({ api });
    }, []);

    return React.createElement(
      "div",
      {
        "data-testid": "ag-grid",
        "data-row-count": rowData.length,
      },
      ...rowData.map((row, index) =>
        React.createElement(
          "span",
          { key: index },
          String(
            row.displayName ??
              row.property ??
              row.name ??
              row.connectorName ??
              "",
          ),
        ),
      ),
    );
  });
  Grid.displayName = "AgGridReactTestDouble";
  return { AgGridReact: Grid };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
