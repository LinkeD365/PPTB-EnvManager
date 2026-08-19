import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Select,
} from "@fluentui/react-components";
import { AddRegular, DeleteRegular } from "@fluentui/react-icons";
import { EnvGroupRuleRow } from "../utils/envMgmt";

export type KnowledgeSourceUrlRule = {
  url: string;
  order: number;
  behavior: "Allow" | "Deny";
};

interface KnowledgeSourceEditorProps {
  onApply: (rule: EnvGroupRuleRow, value: string) => void;
}

interface KnowledgeSourceEditorState {
  editor: {
    rule: EnvGroupRuleRow;
    value: string;
  } | null;
}

export class KnowledgeSourceEditor extends React.PureComponent<
  KnowledgeSourceEditorProps,
  KnowledgeSourceEditorState
> {
  public state: KnowledgeSourceEditorState = { editor: null };

  public static parseRules(value: string): KnowledgeSourceUrlRule[] {
    try {
      return (JSON.parse(value) as unknown[]).map((rule, index) => ({
        url: String((rule as Record<string, unknown>).url ?? ""),
        order: index + 1,
        behavior:
          (rule as Record<string, unknown>).behavior === "Deny"
            ? "Deny"
            : "Allow",
      }));
    } catch {
      return [];
    }
  }

  public static getValueLabel(value: string): string {
    try {
      JSON.parse(value);
    } catch {
      return value;
    }

    const rules = KnowledgeSourceEditor.parseRules(value);
    return rules.length === 1 && rules[0].url === "*"
      ? rules[0].behavior === "Allow"
        ? "All"
        : "None"
      : "Custom";
  }

  public static renderValue(value: string): React.ReactNode {
    const rules = KnowledgeSourceEditor.parseRules(value);
    if (rules.length === 1 && rules[0].url === "*") {
      return rules[0].behavior === "Allow" ? "All" : "None";
    }

    const summary = [
      ...rules
        .slice(0, -1)
        .map((urlRule) => `${urlRule.url} (${urlRule.behavior})`),
      ...(rules.length > 0
        ? [`Default (${rules[rules.length - 1].behavior})`]
        : []),
    ].join(", ");

    return (
      <div
        title={summary}
        style={{
          width: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {summary}
      </div>
    );
  }

  public static canonicalizeRules(value: string): KnowledgeSourceUrlRule[] {
    const rules = KnowledgeSourceEditor.parseRules(value);

    if (
      rules.length === 0 ||
      rules[rules.length - 1].url !== "*" ||
      rules.slice(0, -1).some((rule) => !rule.url.trim() || rule.url === "*")
    ) {
      throw new Error(
        "Custom knowledge source rules require URLs followed by a default rule.",
      );
    }

    return rules.map((rule, index) => ({ ...rule, order: index + 1 }));
  }

  public open = (rule: EnvGroupRuleRow): void => {
    this.setState({ editor: { rule, value: rule.newValueString } });
  };

  private close = (): void => {
    this.setState({ editor: null });
  };

  private setValue = (value: string): void => {
    this.setState(({ editor }) => ({
      editor: editor ? { ...editor, value } : null,
    }));
  };

  private updateCustomRules = (
    nextRules: KnowledgeSourceUrlRule[],
    nextDefaultBehavior?: "Allow" | "Deny",
  ): void => {
    const rules = KnowledgeSourceEditor.parseRules(
      this.state.editor?.value ?? "",
    );
    const defaultBehavior =
      nextDefaultBehavior ?? rules[rules.length - 1]?.behavior ?? "Deny";

    this.setValue(
      JSON.stringify(
        [...nextRules, { url: "*", behavior: defaultBehavior, order: 0 }].map(
          (rule, index) => ({ ...rule, order: index + 1 }),
        ),
      ),
    );
  };

  private apply = (): void => {
    const { editor } = this.state;
    if (!editor) {
      return;
    }

    try {
      this.props.onApply(
        editor.rule,
        JSON.stringify(KnowledgeSourceEditor.canonicalizeRules(editor.value)),
      );
      this.close();
    } catch (error) {
      window.toolboxAPI.utils.showNotification({
        title: "Invalid knowledge source rules",
        body: String(error),
        type: "error",
        duration: 4000,
      });
    }
  };

  private renderEditor(): React.JSX.Element | null {
    const { editor } = this.state;
    if (!editor) {
      return null;
    }

    const rules = KnowledgeSourceEditor.parseRules(editor.value);
    const mode =
      rules.length === 1 && rules[0].url === "*"
        ? rules[0].behavior === "Allow"
          ? "all"
          : "none"
        : "custom";
    const customRules = rules.slice(0, -1);
    const defaultBehavior = rules[rules.length - 1]?.behavior ?? "Deny";

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          width: "100%",
          padding: "4px 0",
        }}
      >
        <Select
          value={mode}
          onChange={(_, data) => {
            if (data.value === "all" || data.value === "none") {
              this.setValue(
                JSON.stringify([
                  {
                    url: "*",
                    order: 1,
                    behavior: data.value === "all" ? "Allow" : "Deny",
                  },
                ]),
              );
            } else if (mode !== "custom") {
              this.updateCustomRules([
                { url: "", order: 1, behavior: "Allow" },
              ]);
            }
          }}
        >
          <option value="none">None</option>
          <option value="all">All</option>
          <option value="custom">Custom</option>
        </Select>
        {mode === "custom" && (
          <>
            {customRules.map((urlRule, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(120px, 1fr) 100px 32px",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <Input
                  value={urlRule.url}
                  aria-label={`Knowledge source URL ${index + 1}`}
                  onChange={(_, data) =>
                    this.updateCustomRules(
                      customRules.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, url: data.value }
                          : item,
                      ),
                    )
                  }
                />
                <Select
                  value={urlRule.behavior}
                  aria-label={`Behavior for URL ${index + 1}`}
                  onChange={(_, data) =>
                    this.updateCustomRules(
                      customRules.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              behavior: data.value as "Allow" | "Deny",
                            }
                          : item,
                      ),
                    )
                  }
                >
                  <option value="Allow">Allow</option>
                  <option value="Deny">Deny</option>
                </Select>
                <Button
                  icon={<DeleteRegular />}
                  aria-label={`Remove URL ${index + 1}`}
                  disabled={customRules.length === 1}
                  onClick={() =>
                    this.updateCustomRules(
                      customRules.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                />
              </div>
            ))}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Button
                icon={<AddRegular />}
                onClick={() =>
                  this.updateCustomRules([
                    ...customRules,
                    {
                      url: "",
                      order: customRules.length + 1,
                      behavior: "Allow",
                    },
                  ])
                }
              >
                Add URL
              </Button>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>Default</span>
                <Select
                  value={defaultBehavior}
                  aria-label="Default knowledge source behavior"
                  onChange={(_, data) =>
                    this.updateCustomRules(
                      customRules,
                      data.value as "Allow" | "Deny",
                    )
                  }
                >
                  <option value="Allow">Allow</option>
                  <option value="Deny">Deny</option>
                </Select>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  public render(): React.JSX.Element {
    const { editor } = this.state;

    return (
      <Dialog
        open={Boolean(editor)}
        onOpenChange={(_, data) => {
          if (!data.open) {
            this.close();
          }
        }}
      >
        <DialogSurface
          style={{ width: "min(760px, calc(100vw - 32px))", maxWidth: 760 }}
        >
          <DialogBody>
            <DialogTitle>
              {editor?.rule.shortDescription ?? "Knowledge source rules"}
            </DialogTitle>
            <DialogContent>{this.renderEditor()}</DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={this.close}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={this.apply}>
                Apply
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    );
  }
}
