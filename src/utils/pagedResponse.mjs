export function assertCompleteListResponse(response, resourceName) {
  if (!response || typeof response !== "object") {
    return;
  }

  const record = response;
  const continuation = [
    record["@odata.nextLink"],
    record.nextLink,
    record.nextPageLink,
  ].find((value) => typeof value === "string" && value.trim());

  if (continuation) {
    throw new Error(
      `The ${resourceName} response contains additional pages. Reloading this list is blocked because this API client cannot safely follow its continuation link.`,
    );
  }
}
