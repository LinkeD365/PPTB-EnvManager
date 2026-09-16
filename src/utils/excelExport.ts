import type { GridApi } from "ag-grid-community";
import type { Cell, SheetData } from "write-excel-file";

export type ExcelValue = string | number | boolean | null | undefined;

export interface ExcelColumn {
  header: string;
  width?: number;
}

export interface ExcelSheet {
  name: string;
  columns: ExcelColumn[];
  rows: ExcelValue[][];
}

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const baseName = sanitized || "environment-manager-export";
  return baseName.toLowerCase().endsWith(".xlsx")
    ? baseName
    : `${baseName}.xlsx`;
}

function sanitizeSheetNames(sheets: ExcelSheet[]): string[] {
  const usedNames = new Set<string>();

  return sheets.map((sheet, index) => {
    const baseName =
      sheet.name.replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim() ||
      `Sheet ${index + 1}`;
    let name = baseName.slice(0, 31);
    let suffix = 2;

    while (usedNames.has(name.toLowerCase())) {
      const suffixText = ` (${suffix++})`;
      name = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`;
    }

    usedNames.add(name.toLowerCase());
    return name;
  });
}

function toCell(value: ExcelValue): Cell {
  return {
    value: value ?? "",
    wrap: true,
    alignVertical: "top",
  };
}

function toSheetData(sheet: ExcelSheet): SheetData {
  return [
    sheet.columns.map(
      (column): Cell => ({
        value: column.header,
        fontWeight: "bold",
        backgroundColor: "#E8EBFA",
        alignVertical: "center",
        wrap: true,
      }),
    ),
    ...sheet.rows.map((row) =>
      sheet.columns.map((_, index) => toCell(row[index])),
    ),
  ];
}

export async function exportExcelWorkbook(
  fileName: string,
  sheets: ExcelSheet[],
): Promise<void> {
  const exportableSheets = sheets.filter(
    (sheet) => sheet.columns.length > 0 && sheet.rows.length > 0,
  );

  if (exportableSheets.length === 0) {
    throw new Error("There is no loaded grid data to export.");
  }

  const { default: writeXlsxFile } = await import("write-excel-file");
  await writeXlsxFile(exportableSheets.map(toSheetData), {
    fileName: sanitizeFileName(fileName),
    sheets: sanitizeSheetNames(exportableSheets),
    columns: exportableSheets.map((sheet) =>
      sheet.columns.map((column) => ({ width: column.width ?? 24 })),
    ),
    stickyRowsCount: 1,
  });
}

export function getDisplayedGridRows<T>(api: GridApi<T> | undefined): T[] {
  const rows: T[] = [];
  api?.forEachNodeAfterFilterAndSort((node) => {
    if (node.data) {
      rows.push(node.data);
    }
  });
  return rows;
}
