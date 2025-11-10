import { useCallback, useEffect, useState } from "react";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { DataverseAPIDemo } from "./components/DataverseAPIDemo";
import { EventLog } from "./components/EventLog";
import { ToolboxAPIDemo } from "./components/ToolboxAPIDemo";
import { useConnection, useEventLog, useToolboxEvents } from "./hooks/useToolboxAPI";
import { EnvManager } from "./components/EnvManager";
import { ViewModel } from "./model/ViewModel";
import { dvService } from "./utils/dataverse";

function App() {
    const { connection, isLoading, refreshConnection } = useConnection();
    const { logs, addLog, clearLogs  } = useEventLog();

    // Handle platform events
    const handleEvent = useCallback(
        (event: string, _data: any) => {
            switch (event) {
                case 'connection:updated':
                case 'connection:created':
                    refreshConnection();
                    break;

                case 'connection:deleted':
                    refreshConnection();
                    break;

                case 'terminal:output':
                case 'terminal:command:completed':
                case 'terminal:error':
                    // Terminal events handled by dedicated components
                    break;
            }
        },
        [refreshConnection]
    );

    useToolboxEvents(handleEvent);

    // Add initial log (run only once on mount)
    useEffect(() => {
        addLog('React Sample Tool initialized CC', 'success');
    }, [addLog]);
    const [viewModel] = useState(() => new ViewModel());
    const dvSvc = new dvService({
        connection: connection,
        dvApi: window.dataverseAPI,
        onLog: addLog
    });
    return (
        <>
            <EnvManager connection={connection} dvService={dvSvc} isLoading={isLoading} viewModel={viewModel} onLog={addLog} />
            <ConnectionStatus connection={connection} isLoading={isLoading} />
 
            <ToolboxAPIDemo onLog={addLog} />

            <DataverseAPIDemo connection={connection} onLog={addLog} />

            <EventLog logs={logs} onClear={clearLogs} />

        </>
    );
}

export default App;
