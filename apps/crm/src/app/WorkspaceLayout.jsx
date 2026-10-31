import React from 'react';
import { Sidebar } from '../components/layout/Sidebar.jsx';
import { Header } from '../components/layout/Header.jsx';
import { PageHeading } from '../components/layout/PageHeading.jsx';
import { ErrorBoundary } from '../components/ui/ErrorBoundary.jsx';
import { WorkspaceBanner } from '../features/workspaces/WorkspaceBanner.jsx';
import { FeatureRoutes } from './FeatureRoutes.jsx';
import { WorkspaceDialogs } from './WorkspaceDialogs.jsx';
import { WorkspaceNotifications } from './WorkspaceNotifications.jsx';
import { WorkspaceNotices } from './WorkspaceNotices.jsx';
import { useNavigation } from '../hooks/useWorkspace.js';

export function WorkspaceLayout() {
  const { route } = useNavigation();
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="main-area">
        <Header />
        <main className="main-content" id="main-content" tabIndex={-1}>
          <WorkspaceBanner />
          <PageHeading />
          <WorkspaceNotices />
          <ErrorBoundary key={route}>
            <FeatureRoutes />
          </ErrorBoundary>
          <footer className="main-footer">
            <span>© {new Date().getFullYear()} Keys with Simoni · Real Estate Studio</span>
            <span>Built for focus, relationships & opportunity.</span>
          </footer>
        </main>
      </div>
      <WorkspaceDialogs />
      <WorkspaceNotifications />
    </div>
  );
}
