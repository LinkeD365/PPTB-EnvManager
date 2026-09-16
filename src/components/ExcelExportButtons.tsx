import React from "react";
import {
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  SplitButton,
  type MenuButtonProps,
} from "@fluentui/react-components";
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
  currentLabel: string;
}

export function ExcelExportButtons({
  fileName,
  getCurrentSheets,
  getAllSheets,
  disabled = false,
  currentLabel,
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
      <Menu positioning="below-end">
        <MenuTrigger disableButtonEnhancement>
          {(triggerProps: MenuButtonProps) => (
            <SplitButton
              appearance="subtle"
              size="small"
              icon={<ArrowDownloadRegular />}
              menuButton={triggerProps}
              primaryActionButton={{
                onClick: () => void runExport(getCurrentSheets),
              }}
              disabled={disabled || isExporting}
            >
              {isExporting ? "Exporting..." : currentLabel}
            </SplitButton>
          )}
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem
              icon={<ArrowDownloadRegular />}
              disabled={!getAllSheets || disabled || isExporting}
              onClick={() =>
                getAllSheets && void runExport(getAllSheets, "-all")
              }
            >
              Export all
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
}
