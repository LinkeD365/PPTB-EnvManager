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

export type ExportFormat = "xlsx" | "markdown" | "csv";

export interface GridExportRegistration {
  id: string;
  contextKey?: string;
  rowCount: number;
  getSheet: () => ExcelSheet;
}

function sanitizeFileName(fileName: string, extension: string): string {
  const sanitized = fileName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const baseName = sanitized || "environment-manager-export";
  return baseName.toLowerCase().endsWith(`.${extension}`)
    ? baseName
    : `${baseName}.${extension}`;
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
  const exportableSheets = getExportableSheets(sheets);

  const { default: writeXlsxFile } = await import("write-excel-file");
  await writeXlsxFile(exportableSheets.map(toSheetData), {
    fileName: sanitizeFileName(fileName, "xlsx"),
    sheets: sanitizeSheetNames(exportableSheets),
    columns: exportableSheets.map((sheet) =>
      sheet.columns.map((column) => ({ width: column.width ?? 24 })),
    ),
    stickyRowsCount: 1,
  });
}

function getExportableSheets(sheets: ExcelSheet[]): ExcelSheet[] {
  const exportableSheets = sheets.filter(
    (sheet) => sheet.columns.length > 0,
  );
  if (exportableSheets.length === 0) {
    throw new Error("There is no loaded grid data to export.");
  }
  return exportableSheets;
}

function downloadTextFile(
  fileName: string,
  content: string,
  mimeType: string,
): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function toMarkdownValue(value: ExcelValue): string {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");
}

function exportMarkdown(fileName: string, sheets: ExcelSheet[]): void {
  const content = getExportableSheets(sheets)
    .map((sheet) => {
      const header = `| ${sheet.columns.map((column) => toMarkdownValue(column.header)).join(" | ")} |`;
      const separator = `| ${sheet.columns.map(() => "---").join(" | ")} |`;
      const rows = sheet.rows.map(
        (row) =>
          `| ${sheet.columns.map((_, index) => toMarkdownValue(row[index])).join(" | ")} |`,
      );
      return [`## ${sheet.name}`, "", header, separator, ...rows].join("\n");
    })
    .join("\n\n");

  downloadTextFile(
    sanitizeFileName(fileName, "md"),
    `${content}\n`,
    "text/markdown;charset=utf-8",
  );
}

function toCsvValue(value: ExcelValue): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(fileName: string, sheets: ExcelSheet[]): void {
  const exportableSheets = getExportableSheets(sheets);
  for (const sheet of exportableSheets) {
    const rows = [
      sheet.columns.map((column) => toCsvValue(column.header)).join(","),
      ...sheet.rows.map((row) =>
        sheet.columns.map((_, index) => toCsvValue(row[index])).join(","),
      ),
    ];
    const sheetSuffix =
      exportableSheets.length > 1
        ? `-${sheet.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
        : "";
    downloadTextFile(
      sanitizeFileName(`${fileName}${sheetSuffix}`, "csv"),
      `\uFEFF${rows.join("\r\n")}\r\n`,
      "text/csv;charset=utf-8",
    );
  }
}

export async function exportGridData(
  format: ExportFormat,
  fileName: string,
  sheets: ExcelSheet[],
): Promise<void> {
  if (format === "xlsx") {
    await exportExcelWorkbook(fileName, sheets);
  } else if (format === "markdown") {
    exportMarkdown(fileName, sheets);
  } else {
    exportCsv(fileName, sheets);
  }
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
