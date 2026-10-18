import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrganizationSettingsXml,
  createWriteConfirmation,
  haveReviewedValues,
} from "../src/utils/writeConfirmation.mjs";
import { assertCompleteListResponse } from "../src/utils/pagedResponse.mjs";

test("confirmation identifies the target, changed scope, and no-undo warning", () => {
  const confirmation = createWriteConfirmation(
    "environment settings",
    "Production (https://contoso.crm.dynamics.com)",
    ["AllowPublicAccess", "DisableTrials"],
  );

  assert.equal(
    confirmation.target,
    "Production (https://contoso.crm.dynamics.com)",
  );
  assert.doesNotMatch(confirmation.target, /\b(?:organization|environment)\s+\S+/i);
  assert.equal(confirmation.summary, "This will update 2 environment settings.");
  assert.deepEqual(confirmation.scope, ["AllowPublicAccess", "DisableTrials"]);
  assert.match(confirmation.warning, /There is no in-tool undo/);
});

test("organization settings confirmation explains that the whole XML field is rewritten", () => {
  const confirmation = createWriteConfirmation(
    "organization settings",
    "Production (https://contoso.crm.dynamics.com)",
    ["AllowEmails: true → false"],
  );

  assert.match(confirmation.warning, /complete orgdborgsettings XML field is rewritten/);
  assert.match(confirmation.warning, /preserved with their latest values/);
});

test("confirmation explains the risk of a partial multi-request policy save", () => {
  const confirmation = createWriteConfirmation(
    "environment group policies",
    "Production / Managed Environments",
    ["Allowlisted connectors"],
    true,
  );

  assert.match(confirmation.warning, /partially applied/);
});

test("confirmation requires a target and at least one changed item", () => {
  assert.throws(
    () => createWriteConfirmation("organization settings", " ", ["AllowEmails"]),
    /target environment or resource/,
  );
  assert.throws(
    () => createWriteConfirmation("organization settings", "Production", []),
    /At least one change/,
  );
});

test("organization settings values are escaped as XML text", () => {
  assert.equal(
    buildOrganizationSettingsXml([
      { name: "Message", value: "<admin> & 'operators' \"choice\"" },
    ]),
    "<orgSettings><Message>&lt;admin&gt; &amp; &apos;operators&apos; &quot;choice&quot;</Message></orgSettings>",
  );
});

test("organization settings names cannot alter the XML structure", () => {
  assert.throws(
    () =>
      buildOrganizationSettingsXml([
        { name: "Safe><Injected", value: "true" },
      ]),
    /Invalid organization setting name/,
  );
});

test("reviewed values match only while every server value remains unchanged", () => {
  const reviewed = [
    { key: "AllowPublicAccess", currentValue: false },
    { key: "MaxSessions", currentValue: 20 },
  ];

  assert.equal(
    haveReviewedValues(reviewed, [
      { key: "AllowPublicAccess", currentValue: false },
      { key: "MaxSessions", currentValue: 20 },
    ]),
    true,
  );
  assert.equal(
    haveReviewedValues(reviewed, [
      { key: "AllowPublicAccess", currentValue: true },
      { key: "MaxSessions", currentValue: 20 },
    ]),
    false,
  );
  assert.equal(
    haveReviewedValues(reviewed, [{ key: "AllowPublicAccess", currentValue: false }]),
    false,
  );
});

test("list reads reject responses with continuation links instead of showing partial results", () => {
  assert.doesNotThrow(() =>
    assertCompleteListResponse({ value: [] }, "environment groups"),
  );
  assert.throws(
    () =>
      assertCompleteListResponse(
        { value: [], "@odata.nextLink": "https://api.example/next" },
        "environment groups",
      ),
    /contains additional pages/,
  );
});
