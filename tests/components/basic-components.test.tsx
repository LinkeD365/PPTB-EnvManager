import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComparisonFilterSwitch } from "../../src/components/ComparisonFilterButton";
import { EnvironmentInfoPopup } from "../../src/components/EnvironmentInfo";
import { ExcelExportButtons } from "../../src/components/ExcelExportButtons";
import { InfoPopup, RuleSetInfoPopup } from "../../src/components/Info";
import { InputControl } from "../../src/components/InputControl";
import { KnowledgeSourceEditor } from "../../src/components/KnowledgeSourceEditor";
import { WriteConfirmationDialog } from "../../src/components/WriteConfirmationDialog";
import { orgProp } from "../../src/model/OrgSetting";
import type { EnvApiGridRow } from "../../src/components/EnvironmentSettingsGrid";
import type { EnvGroupRuleRow } from "../../src/utils/envMgmt";
import type { ExcelSheet } from "../../src/utils/excelExport";
import type { WriteConfirmation } from "../../src/utils/writeConfirmation.mjs";

describe("WriteConfirmationDialog", () => {
  const confirmation: WriteConfirmation = {
    title: "Confirm environment settings update",
    summary: "This will update 6 environment settings.",
    target: "Production (https://example.crm.dynamics.com)",
    scope: [
      "Setting 1: old → new",
      "Setting 2: old → new",
      "Setting 3: old → new",
      "Setting 4: old → new",
      "Setting 5: old → new",
      "Setting 6: old → new",
    ],
    warning: "There is no in-tool undo.",
  };

  it("shows target, scope, and warnings and handles confirm/cancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <WriteConfirmationDialog
        confirmation={confirmation}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText(confirmation.target)).toBeTruthy();
    const changes = screen.getByRole("textbox", { name: "Changes (read-only)" });
    expect((changes as HTMLTextAreaElement).readOnly).toBe(true);
    expect((changes as HTMLTextAreaElement).rows).toBe(5);
    expect((changes as HTMLTextAreaElement).value).toBe(confirmation.scope.join("\n"));
    expect((changes as HTMLTextAreaElement).style.width).toBe("100%");
    expect(changes.parentElement?.style.width).toBe("100%");
    expect((changes as HTMLTextAreaElement).style.overflowY).toBe("auto");
    expect((changes as HTMLTextAreaElement).style.backgroundColor).not.toBe("");
    expect(screen.getByText(confirmation.warning)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();

    rerender(
      <WriteConfirmationDialog
        confirmation={null}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByText(confirmation.target)).toBeNull();
  });
});

describe("ComparisonFilterSwitch", () => {
  it("reflects its state and reports toggles", () => {
    const onChange = vi.fn();
    render(
      <ComparisonFilterSwitch showOnlyDifferences={false} onChange={onChange} />,
    );

    const toggle = screen.getByRole("switch");
    expect((toggle as HTMLInputElement).checked).toBe(false);
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("InputControl", () => {
  it("updates boolean settings through the provided callback", () => {
    const item = new orgProp();
    item.name = "EnableFeature";
    item.type = "Boolean";
    item.current = "false";
    item.edit = true;
    const onChange = vi.fn();

    render(<InputControl item={item} setItemNewValue={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "EnableFeature boolean" }));

    expect(onChange).toHaveBeenCalledWith(item, "true", 0);
  });

  it("clamps number input to the setting's allowed range", () => {
    const item = new orgProp();
    item.name = "MaxItems";
    item.type = "Number";
    item.current = "3";
    item.min = "1";
    item.max = "5";
    item.edit = true;
    const onChange = vi.fn();

    render(<InputControl item={item} setItemNewValue={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "MaxItems number" }), {
      target: { value: "10" },
    });

    expect(onChange).toHaveBeenCalledWith(item, "5", 0);
  });
});

describe("information popovers", () => {
  it("renders setting details", () => {
    const item = new orgProp();
    item.name = "EnableFeature";
    item.description = "<strong>Setting description</strong><img src=x onerror=alert(1)>";

    render(<InfoPopup item={item} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("EnableFeature")).toBeTruthy();
    expect(screen.getByText("Setting description")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows policy information and only renders a non-empty learn-more URL", () => {
    const { unmount } = render(
      <RuleSetInfoPopup
        name="Connector policy"
        description="Policy description"
        isPreview
        learnMoreText="Documentation"
        learnMoreLink="  "
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More information about Connector policy" }));
    expect(screen.getByText("Connector policy (Preview)")).toBeTruthy();
    expect(screen.getByText("Policy description")).toBeTruthy();
    expect(screen.queryByText("Documentation")).toBeNull();

    unmount();
    render(
      <RuleSetInfoPopup
        name="Connector policy"
        learnMoreText="Documentation"
        learnMoreLink="https://example.com/docs"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More information about Connector policy" }));
    expect(screen.getByRole("link", { name: "Documentation" }).getAttribute("href")).toBe("https://example.com/docs");
  });

  it("renders environment setting guidance and invokes the host browser on safe links", () => {
    const openInConnectionBrowser = vi.fn();
    window.toolboxAPI = {
      utils: { openInConnectionBrowser },
    } as unknown as typeof window.toolboxAPI;
    const item: EnvApiGridRow = {
      property: "AllowPublicAccess",
      current: true,
      new: true,
      edit: false,
      valueType: "boolean",
      shortDescription: "Controls public access.",
      link: "https://example.com/docs",
    };

    render(<EnvironmentInfoPopup item={item} />);
    fireEvent.click(screen.getByRole("button", { name: "Info for AllowPublicAccess" }));
    expect(screen.getByText("Controls public access.")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Learn more" }));
    expect(openInConnectionBrowser).toHaveBeenCalledWith("https://example.com/docs");
  });
});

describe("ExcelExportButtons", () => {
  it("opens the format picker for the current grid", () => {
    const sheet: ExcelSheet = {
      name: "Settings",
      columns: [{ header: "Setting" }],
      rows: [["Example"]],
    };
    render(
      <ExcelExportButtons
        fileName="settings"
        getCurrentSheets={() => [sheet]}
        currentLabel="Export Settings"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Export Settings" }));
    expect(screen.getByRole("button", { name: "Excel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Markdown" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "CSV" })).toBeTruthy();
  });

  it("disables exports when no exportable data is available", () => {
    render(
      <ExcelExportButtons
        fileName="settings"
        getCurrentSheets={() => []}
        disabled
        currentLabel="Export Settings"
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Export Settings" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe("KnowledgeSourceEditor", () => {
  it("opens the editor and supports its static value summaries", () => {
    const ref = React.createRef<KnowledgeSourceEditor>();
    const onApply = vi.fn();
    const rule = {
      shortDescription: "Knowledge source URLs",
      newValueString: '[{"url":"*","behavior":"Allow"}]',
    } as EnvGroupRuleRow;
    render(<KnowledgeSourceEditor ref={ref} onApply={onApply} />);

    expect(KnowledgeSourceEditor.getValueLabel(rule.newValueString)).toBe("All");
    expect(KnowledgeSourceEditor.renderValue(rule.newValueString)).toBe("All");
    act(() => ref.current?.open(rule));
    expect(screen.getByText("Knowledge source URLs")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });
});
