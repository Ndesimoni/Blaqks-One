import React from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '../components/ui/ErrorBoundary.jsx';
import { ErrorBoundaryFallback } from '../components/ui/ErrorBoundaryFallback.jsx';
import { OwnerSetupPage, AccountLinkPreviewPage } from '../features/team/AccountPreviewPages.jsx';
import { RequireSession, SignInRoute, SignOutRoute } from '../features/auth/SessionRoutes.jsx';
import { WorkspaceProvider } from './WorkspaceProvider.jsx';
import { SessionProvider } from './SessionProvider.jsx';
import { TeamProvider } from './TeamProvider.jsx';
import { NavigationGuardProvider } from './NavigationGuardProvider.jsx';
import { WorkspaceLayout } from './WorkspaceLayout.jsx';

const router = createHashRouter([
  {
    element: <NavigationGuardProvider />,
    children: [
      { path: '/setup-preview', element: <OwnerSetupPage /> },
      { path: '/invite-preview', element: <AccountLinkPreviewPage kind="invite" /> },
      { path: '/reset-preview', element: <AccountLinkPreviewPage kind="reset" /> },
      { path: '/email-preview', element: <AccountLinkPreviewPage kind="email" /> },
      { path: '/sign-in', element: <SignInRoute />, errorElement: <ErrorBoundaryFallback /> },
      { path: '/sign-out', element: <SignOutRoute />, errorElement: <ErrorBoundaryFallback /> },
      {
        path: '*',
        element: (
          <RequireSession>
            <WorkspaceProvider>
              <WorkspaceLayout />
            </WorkspaceProvider>
          </RequireSession>
        ),
        errorElement: <ErrorBoundaryFallback />,
      },
    ],
  },
]);

export default function App() {
  return (
    <ErrorBoundary>
      <TeamProvider>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </TeamProvider>
    </ErrorBoundary>
  );
}
