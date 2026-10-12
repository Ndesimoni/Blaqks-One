import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useSession.js';
import { useNavigation, useWorkspaceView, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { labels } from '../../config/navigation.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { ServerHeader } from './ServerHeader.jsx';
import { ServerNavigation } from './ServerNavigation.jsx';
import { ServerDialogs } from './ServerDialogs.jsx';
import { connectedCollections } from './records.js';
import { ServerImportAction } from './ServerImportAction.jsx';
import { ServerContent } from './ServerContent.jsx';
import { ServerWorkspacePicker } from './ServerWorkspacePicker.jsx';
import { sectionDescription } from './sectionStatus.js';

export function ServerShell({ owner, workspaces }) {
  const { user } = useSession();
  const { route } = useNavigation();
  const supported = connectedCollections.includes(route);
  const team = route === 'Team & access';
  const { toast, setToast } = useWorkspaceView();
  const { busy } = useWorkspaceActions();
  const location = useLocation();
  const go = useNavigate();
  const selectWorkspace = (id) => {
    const params = new URLSearchParams(location.search);
    params.set('workspace', id);
    go({ pathname: location.pathname, search: `?${params}` });
  };
  return (
    <div className="app-shell connected-shell">
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
      <ServerNavigation />
      <div className="main-area">
        <ServerHeader />
        <main className="main-content" id="main-content" tabIndex={-1}>
          <section className="workspace-banner" aria-label="Active workspace">
            <Icon name="shield" size={20} />
            <div>
              <span>
                {owner.status === 'archived'
                  ? 'ARCHIVED WORKSPACE · READ-ONLY'
                  : 'CONNECTED WORKSPACE'}
              </span>
              <strong>{owner.name}</strong>
              <p>
                {owner.status === 'archived'
                  ? 'This Admin account and its team have been removed. Saved records remain available for review; changes are disabled.'
                  : 'Clients, contacts and properties are saved to your CRM server.'}
              </p>
            </div>
            {user.roleId === 'super-admin' && (
              <ServerWorkspacePicker
                owner={owner}
                workspaces={workspaces}
                busy={busy}
                onSelect={selectWorkspace}
              />
            )}
          </section>
          <div className="page-heading">
            <div className="heading-left">
              <div className="eyebrow">YOUR BUSINESS, CONNECTED</div>
              <h1>{team ? 'Team' : labels[route] || 'Your CRM workspace'}</h1>
              <p>
                {team
                  ? owner.status === 'archived'
                    ? 'Review saved accounts and access history.'
                    : 'Manage people and access within this workspace.'
                  : sectionDescription(route)}
              </p>
            </div>
            <div className="heading-actions">
              {(supported || team) && <ServerImportAction owner={owner} workspaces={workspaces} />}
            </div>
          </div>
          <ServerContent owner={owner} />
          <footer className="main-footer">
            <span>© {new Date().getFullYear()} Keys with Simoni</span>
            <span>Connected CRM · Messaging and public publication are not connected yet.</span>
          </footer>
        </main>
      </div>
      <ServerDialogs />
      {toast && (
        <div className="toast" role="status">
          <Icon name="info" size={17} />
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
