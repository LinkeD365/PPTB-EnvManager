import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';

// Ensure DOM is ready and root element exists
const rootElement = document.getElementById('root');
if (rootElement && !rootElement.hasAttribute('data-reactroot-initialized')) {
    // Mark as initialized to prevent double rendering
    rootElement.setAttribute('data-reactroot-initialized', 'true');
    
    createRoot(rootElement).render(
        <StrictMode>
             <FluentProvider theme={webLightTheme}>
    <App />
  </FluentProvider>,
        </StrictMode>
    );
} else if (!rootElement) {
    console.error('Root element not found. Make sure the HTML contains <div id="root"></div>');
}
