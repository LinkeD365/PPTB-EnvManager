import React from "react";
import { Switch } from "@fluentui/react-components";

interface ComparisonFilterSwitchProps {
  showOnlyDifferences: boolean;
  onChange: (showOnlyDifferences: boolean) => void;
}

export function comparisonValuesDiffer(
  leftValue: unknown,
  rightValue: unknown,
): boolean {
  return String(leftValue ?? "") !== String(rightValue ?? "");
}

export function ComparisonFilterSwitch({
  showOnlyDifferences,
  onChange,
}: ComparisonFilterSwitchProps): React.JSX.Element {
  const label = showOnlyDifferences ? "Differences Only" : "All";

  return (
    <Switch
      checked={showOnlyDifferences}
      label={label}
      labelPosition="before"
      onChange={(_, data) => onChange(data.checked)}
    />
  );
}
