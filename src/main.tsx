import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Ensure DOM is ready and root element exists
const rootElement = document.getElementById("root");
if (rootElement && !rootElement.hasAttribute("data-reactroot-initialized")) {
  // Mark as initialized to prevent double rendering
  rootElement.setAttribute("data-reactroot-initialized", "true");

  (async () => {
    console.log("Initializing React application...");

    //console.log("Theme from settings:", theme);
    //  const currentTheme = await window.toolboxAPI.settings.getSettings();
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })();
} else if (!rootElement) {
  console.error('Root element not found. Make sure the HTML contains <div id="root"></div>');
}
