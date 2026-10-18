export type WriteKind =
  | "organization settings"
  | "environment settings"
  | "environment group policies";

export interface WriteConfirmation {
  title: string;
  summary: string;
  target: string;
  scope: string[];
  warning: string;
}

export function createWriteConfirmation(
  kind: WriteKind,
  target: string,
  scope: string[],
  mayPartiallyApply?: boolean,
): WriteConfirmation;

export function haveReviewedValues(
  expected: Array<{ key: string; currentValue: unknown }>,
  actual: Array<{ key: string; currentValue: unknown }>,
): boolean;

export function buildOrganizationSettingsXml(
  settings: Array<{ name: string; value: string }>,
): string;
