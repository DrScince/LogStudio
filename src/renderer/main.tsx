import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

console.log('LogStudio: Starting application...');
console.log('LogStudio: electronAPI available:', typeof window !== 'undefined' && 'electronAPI' in window);

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('LogStudio: Root element not found!');
} else {
  console.log('LogStudio: Root element found, rendering app...');
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('LogStudio: App rendered successfully');
}
