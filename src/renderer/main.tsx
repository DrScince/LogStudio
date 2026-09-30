import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

console.log('LogStudio: Starting application...');
console.log('LogStudio: electronAPI available:', typeof window !== 'undefined' && 'electronAPI' in window);

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('LogStudio: Root element not found!');
} else {
  console.log('LogStudio: Root element found, rendering app...');
  void import('./App')
    .then(({ default: App }) => {
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
      console.log('LogStudio: App rendered successfully');
    })
    .catch((error) => {
      console.error('LogStudio: Failed to load App', error);
      const message = error instanceof Error ? error.message : String(error);
      const safe = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      rootElement.innerHTML = `
        <div style="font-family:system-ui,sans-serif;color:#e6edf3;background:#0d1117;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;text-align:center">
          <div>
            <h2 style="margin:0 0 0.75rem">LogStudio konnte nicht starten</h2>
            <p style="color:#8b949e;margin:0 0 1rem">Bitte DevTools (F12) prüfen oder npm run dev neu starten.</p>
            <pre style="text-align:left;background:#161b22;padding:1rem;border-radius:8px;max-width:40rem;overflow:auto;white-space:pre-wrap">${safe}</pre>
          </div>
        </div>
      `;
      document.getElementById('boot-splash')?.remove();
    });
}
