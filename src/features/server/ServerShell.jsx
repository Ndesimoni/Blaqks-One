import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon.jsx';
import { labels } from '../../config/navigation.js';
import { useSession } from '../../hooks/useSession.js';
import { useNavigation, useWorkspaceActions, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { useI18n } from '../../i18n/useI18n.js';
import { ServerContent } from './ServerContent.jsx';
import { ServerDialogs } from './ServerDialogs.jsx';
import { ServerHeader } from './ServerHeader.jsx';
import { ServerImportAction } from './ServerImportAction.jsx';
import { ServerNavigation } from './ServerNavigation.jsx';
import { ServerWorkspacePicker } from './ServerWorkspacePicker.jsx';
import { ViewOnlyChip } from './ViewOnlyChip.jsx';
import { activityLabel } from './access.js';
import { isRecordSection, sectionDescription } from './sectionStatus.js';

/** Connected headings that differ from the shared labels (messaging is not part of My profile). */
const headings = { 'My profile': 'My profile' };
/** Sections built on the language foundation take their heading from the catalogues. */
const translated = {
  Inbox: 'inbox',
  'Team chat': 'chat',
  Channels: 'channels',
  'Inbox rules': 'inboxRules',
  'My mailbox': 'mailbox',
  'Google sign-in': 'mailbox',
  Agreements: 'agreements',
  'Shared record': 'recordShares',
};

export function ServerShell({ owner, workspaces }) {
  const { user } = useSession();
  const { t } = useI18n();
  const { route } = useNavigation();
  const supported = isRecordSection(route);
  const team = route === 'Team & access';
  const title = route === 'Team activity' ? activityLabel(user) : route;
  // Inbox and Team chat fill the window like messenger apps: no page heading or footer.
  const fullHeight = ['Inbox', 'Team chat'].includes(route);
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
      <div className={'main-area' + (fullHeight ? ' is-full-height' : '')}>
        <ServerHeader owner={owner} />
        <main className="main-content" id="main-content" tabIndex={-1}>
          {/* Members see their company in the top bar; the panel is only for the Super Admin,
              who switches companies, and for archived (read-only) workspaces. */}
          {(user.roleId === 'super-admin' || owner.status === 'archived') && (
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
                    : 'Clients, contacts, properties and client activity are saved to your CRM server.'}
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
          )}
          {/* The full-height tools keep accessible headings of their own. */}
          {!fullHeight && (
            <div className="page-heading">
              <div className="heading-left">
                <h1>
                  {team
                    ? 'Team'
                    : translated[title]
                      ? t(`${translated[title]}.title`)
                      : headings[title] || labels[title] || title || 'Your CRM workspace'}
                </h1>
                <p>
                  {team
                    ? owner.status === 'archived'
                      ? 'Review saved accounts and access history.'
                      : 'Manage people and access within this workspace.'
                    : translated[title]
                      ? t(`${translated[title]}.description`)
                      : sectionDescription(title)}
                </p>
              </div>
              <div className="heading-actions">
                {supported && <ViewOnlyChip module={route} />}
                {(supported || team) && (
                  <ServerImportAction owner={owner} workspaces={workspaces} />
                )}
              </div>
            </div>
          )}
          <ServerContent owner={owner} />
          {!fullHeight && (
            <footer className="main-footer">
              <span>© {new Date().getFullYear()} Keys with Simoni</span>
            </footer>
          )}
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
