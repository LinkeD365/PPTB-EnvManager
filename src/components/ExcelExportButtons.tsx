import React from "react";
import { Button } from "@fluentui/react-components";
import { ArrowDownloadRegular } from "@fluentui/react-icons";
import {
  exportExcelWorkbook,
  type ExcelSheet,
} from "../utils/excelExport";

interface ExcelExportButtonsProps {
  fileName: string;
  getCurrentSheets: () => ExcelSheet[];
  getAllSheets?: () => ExcelSheet[];
  disabled?: boolean;
  showCurrent?: boolean;
}

export function ExcelExportButtons({
  fileName,
  getCurrentSheets,
  getAllSheets,
  disabled = false,
  showCurrent = true,
}: ExcelExportButtonsProps): React.JSX.Element {
  const [isExporting, setIsExporting] = React.useState(false);

  const runExport = React.useCallback(
    async (getSheets: () => ExcelSheet[], suffix = "") => {
      setIsExporting(true);
      try {
        await exportExcelWorkbook(`${fileName}${suffix}`, getSheets());
      } catch (error) {
        console.error("[ExcelExport] export failed", error);
        window.toolboxAPI.utils.showNotification({
          title: "Excel export failed",
          body: error instanceof Error ? error.message : String(error),
          type: "error",
          duration: 4000,
        });
      } finally {
        setIsExporting(false);
      }
    },
    [fileName],
  );

  return (
    <div className="grid-export-toolbar">
      {showCurrent && (
        <Button
          appearance="subtle"
          size="small"
          icon={<ArrowDownloadRegular />}
          disabled={disabled || isExporting}
          onClick={() => void runExport(getCurrentSheets)}
        >
          {isExporting ? "Exporting..." : "Export grid"}
        </Button>
      )}
      {getAllSheets && (
        <Button
          appearance="subtle"
          size="small"
          icon={<ArrowDownloadRegular />}
          disabled={disabled || isExporting}
          onClick={() => void runExport(getAllSheets, "-all")}
        >
          Export all
        </Button>
      )}
    </div>
  );
}
