import React from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary.jsx';
import { ErrorBoundaryFallback } from '../../components/ui/ErrorBoundaryFallback.jsx';
import { NavigationGuardProvider } from '../../app/NavigationGuardProvider.jsx';
import { PreferencesContext } from '../../app/WorkspaceContext.js';
import { useWorkspacePreferences } from '../../hooks/useWorkspacePreferences.js';
import { ServerSession } from './ServerSession.jsx';
import { ServerDirectory } from './ServerDirectory.jsx';
import './shell.css';
import '../server-team/team.css';

function ConnectedRoot() {
  return (
    <ServerSession>
      <ServerDirectory />
    </ServerSession>
  );
}
const router = createHashRouter([
  {
    element: <NavigationGuardProvider />,
    children: [{ path: '*', element: <ConnectedRoot />, errorElement: <ErrorBoundaryFallback /> }],
  },
]);

export default function ServerApp() {
  const preferences = useWorkspacePreferences();
  return (
    <ErrorBoundary>
      <PreferencesContext.Provider value={preferences}>
        <RouterProvider router={router} />
      </PreferencesContext.Provider>
    </ErrorBoundary>
  );
}
