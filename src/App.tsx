import { useCallback, useEffect, useState } from "react";
import { useConnection, useEventLog, useToolboxEvents } from "./hooks/useToolboxAPI";
import { EnvManager } from "./components/EnvManager";
import { ViewModel } from "./model/ViewModel";
import { dvService } from "./utils/dataverse";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";

function App() {
  const { connection, secondaryConnection, isLoading, refreshConnection } = useConnection();
  const { addLog } = useEventLog();
  const [theme, setTheme] = useState<string>("light");
  const [viewModel] = useState(() => new ViewModel());

  const getTheme = useCallback(async () => {
    console.log("Fetching current theme from toolbox API");
    const currentTheme = await window.toolboxAPI.utils.getCurrentTheme();
    setTheme(currentTheme);
    console.log("Current theme set to:", currentTheme);
    viewModel.theme = currentTheme;
    document.body.setAttribute("data-theme", currentTheme);
  }, [viewModel]);

  // Handle platform events
  const handleEvent = useCallback(
    (event: string, _data: any) => {
      console.log("Event received in App component:", event);
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
        case "settings:updated":
          console.log("Theme or settings updated, refreshing theme");
          getTheme();

          break;
      }
    },
    [refreshConnection, getTheme]
  );

  useEffect(() => {
    getTheme();
  }, [getTheme]);

  useToolboxEvents(handleEvent);

  // Add initial log (run only once on mount)
  useEffect(() => {
    addLog("Environment Manager initialized", "success");
  }, [addLog]);

  const dvSvc = new dvService({
    connection: connection,
    secondaryConnection: secondaryConnection,
    dvApi: window.dataverseAPI,
    onLog: addLog,
  });
  return (
    <>
      <FluentProvider theme={theme === "dark" ? webDarkTheme : webLightTheme}>
        <EnvManager
          connection={connection}
          secondaryConnection={secondaryConnection}
          dvService={dvSvc}
          isLoading={isLoading}
          viewModel={viewModel}
          onLog={addLog}
        />
      </FluentProvider>
    </>
  );
}

export default App;
