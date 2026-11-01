import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { ServerWorkspacePicker } from './ServerWorkspacePicker.jsx';

/**
 * The active workspace above the page. Members see their company in the section sidebar, so
 * the banner is only for the Super Admin, who switches companies, and for archived (read-only)
 * workspaces.
 */
export function ServerWorkspaceBanner({ owner, workspaces, platform }) {
  const { user } = useSession();
  const { busy } = useWorkspaceActions();
  const location = useLocation();
  const go = useNavigate();
  if (platform || (user.roleId !== 'super-admin' && owner.status !== 'archived')) return null;
  const archived = owner.status === 'archived';
  const selectWorkspace = (id) => {
    const params = new URLSearchParams(location.search);
    params.set('workspace', id);
    go({ pathname: location.pathname, search: `?${params}` });
  };
  return (
    <section className="workspace-banner" aria-label="Active workspace">
      <Icon name="shield" size={20} />
      <div>
        <span>{archived ? 'ARCHIVED WORKSPACE · READ-ONLY' : 'CONNECTED WORKSPACE'}</span>
        <strong>{owner.name}</strong>
        <p>
          {archived
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
  );
}
