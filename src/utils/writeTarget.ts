export class WriteTargetChangedError extends Error {
  constructor() {
    super("The connection, target, or pending changes changed after review. Review the current values and confirm again. Earlier requests in a multi-request save may already have applied.");
    this.name = "WriteTargetChangedError";
  }
}

export async function assertWriteTarget(
  connections: Pick<ToolBoxAPI.ConnectionsAPI, "getConnections">,
  slot: number,
  expectedConnectionId: string,
  isCurrent: () => boolean,
): Promise<void> {
  if (!isCurrent()) {
    throw new WriteTargetChangedError();
  }
  const activeConnections = await connections.getConnections();
  if (activeConnections[slot]?.id !== expectedConnectionId || !isCurrent()) {
    throw new WriteTargetChangedError();
  }
}
