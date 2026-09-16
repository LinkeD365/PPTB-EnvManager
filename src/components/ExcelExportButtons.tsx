import React from "react";
import {
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Popover,
  PopoverSurface,
  SplitButton,
  type MenuButtonProps,
} from "@fluentui/react-components";
import { ArrowDownloadRegular } from "@fluentui/react-icons";
import {
  exportGridData,
  type ExportFormat,
  type ExcelSheet,
} from "../utils/excelExport";

interface ExcelExportButtonsProps {
  fileName: string;
  getCurrentSheets: () => ExcelSheet[];
  getAllSheets?: () => ExcelSheet[];
  disabled?: boolean;
  allDisabled?: boolean;
  currentLabel: string;
}

export function ExcelExportButtons({
  fileName,
  getCurrentSheets,
  getAllSheets,
  disabled = false,
  allDisabled = false,
  currentLabel,
}: ExcelExportButtonsProps): React.JSX.Element {
  const [isExporting, setIsExporting] = React.useState(false);
  const [formatPickerOpen, setFormatPickerOpen] = React.useState(false);
  const [exportScope, setExportScope] = React.useState<"current" | "all">(
    "current",
  );
  const buttonRef = React.useRef<HTMLButtonElement | HTMLAnchorElement>(null);

  const runExport = React.useCallback(
    async (format: ExportFormat) => {
      const exportAll = exportScope === "all";
      const getSheets = exportAll ? getAllSheets : getCurrentSheets;
      if (!getSheets) {
        return;
      }

      setFormatPickerOpen(false);
      setIsExporting(true);
      try {
        await exportGridData(
          format,
          `${fileName}${exportAll ? "-all" : ""}`,
          getSheets(),
        );
      } catch (error) {
        console.error("[GridExport] export failed", error);
        window.toolboxAPI.utils.showNotification({
          title: "Export failed",
          body: error instanceof Error ? error.message : String(error),
          type: "error",
          duration: 4000,
        });
      } finally {
        setIsExporting(false);
      }
    },
    [exportScope, fileName, getAllSheets, getCurrentSheets],
  );

  return (
    <div className="grid-export-toolbar">
      {getAllSheets ? (
        <Menu positioning="below-end">
          <MenuTrigger disableButtonEnhancement>
            {(triggerProps: MenuButtonProps) => (
              <SplitButton
                ref={buttonRef}
                appearance="subtle"
                size="small"
                icon={<ArrowDownloadRegular />}
                menuButton={{
                  ...triggerProps,
                  disabled: allDisabled || isExporting,
                }}
                primaryActionButton={{
                  disabled: disabled || isExporting,
                  onClick: () => {
                    setExportScope("current");
                    setFormatPickerOpen(true);
                  },
                }}
              >
                {isExporting ? "Exporting..." : currentLabel}
              </SplitButton>
            )}
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem
                icon={<ArrowDownloadRegular />}
                disabled={allDisabled || isExporting}
                onClick={() => {
                  setExportScope("all");
                  setFormatPickerOpen(true);
                }}
              >
                Export all
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      ) : (
        <Button
          ref={buttonRef}
          appearance="subtle"
          size="small"
          icon={<ArrowDownloadRegular />}
          disabled={disabled || isExporting}
          onClick={() => {
            setExportScope("current");
            setFormatPickerOpen(true);
          }}
        >
          {isExporting ? "Exporting..." : currentLabel}
        </Button>
      )}
      <Popover
        open={formatPickerOpen}
        onOpenChange={(_event, data) => setFormatPickerOpen(data.open)}
        positioning={{
          position: "below",
          align: "end",
          target: buttonRef.current,
        }}
      >
        <PopoverSurface tabIndex={-1}>
          <div className="export-format-actions">
            <Button
              appearance="subtle"
              size="small"
              icon={<ArrowDownloadRegular />}
              onClick={() => void runExport("xlsx")}
            >
              Excel
            </Button>
            <Button
              appearance="subtle"
              size="small"
              icon={<ArrowDownloadRegular />}
              onClick={() => void runExport("markdown")}
            >
              Markdown
            </Button>
            <Button
              appearance="subtle"
              size="small"
              icon={<ArrowDownloadRegular />}
              onClick={() => void runExport("csv")}
            >
              CSV
            </Button>
          </div>
        </PopoverSurface>
      </Popover>
    </div>
  );
}
