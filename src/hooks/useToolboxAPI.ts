import { useCallback, useEffect, useState } from "react";

export type LogEntry = {
  timestamp: Date;
  message: string;
  type: "info" | "success" | "warning" | "error";
};

export const MAX_CONNECTIONS = 5;

export function useConnection() {
  const [connections, setConnections] = useState<Array<ToolBoxAPI.DataverseConnection | null>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshConnection = useCallback(async () => {
    try {
      const conns = await window.toolboxAPI.connections.getConnections();
      setConnections((conns ?? []).slice(0, MAX_CONNECTIONS).map((c) => c ?? null));
    } catch (error) {
      console.error("Error refreshing connection:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshConnection();
  }, [refreshConnection]);

  return { connection: connections[0] ?? null, connections, isLoading, refreshConnection };
}

export function useToolboxEvents(onEvent: (event: string, data: any) => void) {
  useEffect(() => {
    const handler = (_event: any, payload: ToolBoxAPI.ToolBoxEventPayload) => {
      onEvent(payload.event, payload.data);
    };

    window.toolboxAPI.events.on(handler);

    return () => {
      // Note: Current API doesn't support unsubscribe
      // This would need to be added to the API
    };
  }, [onEvent]);
}

export function useEventLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Use useCallback without dependencies since we're using the functional update form of setState
  // This ensures the functions are stable across renders and won't cause infinite loops
  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [
      {
        timestamp: new Date(),
        message,
        type,
      },
      ...prev.slice(0, 49), // Keep last 50 entries
    ]);
  }, []); // Empty deps is safe because we use functional setState

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []); // Empty deps is safe because we use functional setState

  return { logs, addLog, clearLogs };
}
