import { useCallback, useEffect, useState } from "react";
import { useConnection, useEventLog, useToolboxEvents } from "./hooks/useToolboxAPI";
import { EnvManager } from "./components/EnvManager";
import { ViewModel } from "./model/ViewModel";
import { dvService } from "./utils/dataverse";

function App() {
  const { connection, secondaryConnection, isLoading, refreshConnection } = useConnection();
  const { addLog } = useEventLog();

  // Handle platform events
  const handleEvent = useCallback(
    (event: string, _data: any) => {
      switch (event) {
        case "connection:updated":
        case "connection:created":
          console.log("Connection event received:", event);
          refreshConnection();
          break;

        case "connection:deleted":
          refreshConnection();
          break;

        case "terminal:output":
        case "terminal:command:completed":
        case "terminal:error":
          // Terminal events handled by dedicated components
          break;
      }
    },
    [refreshConnection]
  );

  useToolboxEvents(handleEvent);

  // Add initial log (run only once on mount)
  useEffect(() => {
    addLog("Environment Manager initialized", "success");
  }, [addLog]);
  const [viewModel] = useState(() => new ViewModel());
  const dvSvc = new dvService({
    connection: connection,
    secondaryConnection: secondaryConnection,
    dvApi: window.dataverseAPI,
    onLog: addLog,
  });
  return (
    <>
      <EnvManager
        connection={connection}
        secondaryConnection={secondaryConnection}
        dvService={dvSvc}
        isLoading={isLoading}
        viewModel={viewModel}
        onLog={addLog}
      />
    </>
  );
}

export default App;
