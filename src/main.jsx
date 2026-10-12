import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';

const App = lazy(() =>
  import.meta.env.VITE_CRM_MODE === 'server'
    ? import('./features/server/ServerApp.jsx')
    : import('./app/App.jsx'),
);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<main className="session-status">Opening Keys with Simoni…</main>}>
      <App />
    </Suspense>
  </React.StrictMode>,
);
