import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

const mountApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    return;
  }

  // Prevent multiple roots on the same container
  if ((rootElement as any)._reactRoot) {
    return;
  }

  try {
    const root = ReactDOM.createRoot(rootElement);
    (rootElement as any)._reactRoot = root;
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("Failed to mount React application", err);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}