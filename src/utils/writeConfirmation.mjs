const kindLabels = {
  "organization settings": "organization setting",
  "environment settings": "environment setting",
  "environment group policies": "environment group policy",
};

export function createWriteConfirmation(
  kind,
  target,
  scope,
  mayPartiallyApply = false,
) {
  const normalizedTarget = target.trim();
  const normalizedScope = [...new Set(scope.map((item) => item.trim()).filter(Boolean))];

  if (!normalizedTarget) {
    throw new Error("A target environment or resource is required to confirm a write.");
  }
  if (normalizedScope.length === 0) {
    throw new Error("At least one change must be listed before confirming a write.");
  }

  const itemLabel = kindLabels[kind];
  if (!itemLabel) {
    throw new Error(`Unsupported write confirmation kind: ${kind}`);
  }

  return {
    title: `Confirm ${kind} update`,
    summary: `This will update ${normalizedScope.length} ${itemLabel}${normalizedScope.length === 1 ? "" : "s"}.`,
    target: normalizedTarget,
    scope: normalizedScope,
    warning: [
      "There is no in-tool undo. Export or record the current values before applying if you may need to restore them.",
      kind === "organization settings"
        ? "The complete orgdborgsettings XML field is rewritten; other settings are preserved with their latest values."
        : "",
      mayPartiallyApply
        ? "This save uses multiple requests and may be partially applied if a later request fails."
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function haveReviewedValues(expected, actual) {
  const currentByKey = new Map(
    actual.map(({ key, currentValue }) => [key, currentValue]),
  );
  return expected.every(
    ({ key, currentValue }) => currentByKey.get(key) === currentValue,
  );
}

export function buildOrganizationSettingsXml(settings) {
  const escapeXmlText = (value) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  return `<orgSettings>${settings
    .map(({ name, value }) => {
      if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) {
        throw new Error(`Invalid organization setting name: ${name}`);
      }

      return `<${name}>${escapeXmlText(value)}</${name}>`;
    })
    .join("")}</orgSettings>`;
}
