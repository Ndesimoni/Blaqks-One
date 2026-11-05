import React, { useState } from 'react';
import { useWorkspaceScope } from '../../hooks/useWorkspaceScope.js';
import { useWorkspaceOverview } from '../../hooks/useWorkspaceOverview.js';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { Badge } from '../../components/ui/Badge.jsx';

export function WorkspacesPage() {
  const { owner: current, openWorkspace } = useWorkspaceScope();
  const { snapshots, refresh } = useWorkspaceOverview();
  const [query, setQuery] = useState('');
  const matching = snapshots.filter(({ owner }) =>
    `${owner.name} ${owner.role}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const totals = snapshots.reduce(
    (sum, item) => ({
      clients: sum.clients + (item.workspace?.data.Clients.length || 0),
      properties: sum.properties + (item.workspace?.data.Properties.length || 0),
      activities: sum.activities + (item.workspace?.activity?.length || 0),
    }),
    { clients: 0, properties: 0, activities: 0 },
  );
  return (
    <div className="page-stack">
      <div className="team-notice">
        <Icon name="info" size={18} />
        <p>
          Each profile has its own records. Opening a workspace keeps its clients, contacts,
          properties and reports together. The Super Admin workspace contains the previous shared
          records. This preview uses this browser’s data.
        </p>
      </div>
      <div className="team-metrics">
        {[
          ['Workspaces', snapshots.length],
          ['Leads & clients', totals.clients],
          ['Properties', totals.properties],
          ['Recorded actions', totals.activities],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="panel workspace-directory">
        <div className="workspace-directory-heading">
          <div>
            <h2>Workspace directory</h2>
            <p>{matching.length} matching workspaces</p>
          </div>
          <Button variant="light" onClick={refresh}>
            Refresh workspaces
          </Button>
        </div>
        <div className="search-small">
          <Icon name="search" size={17} />
          <input
            aria-label="Search workspaces"
            placeholder="Search member or role"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <OverflowList
          mode="all"
          key={query}
          items={matching}
          label="Member workspaces"
          getKey={(item) => item.owner.id}
          activeKey={current.id}
          listClassName="workspace-card-list"
          renderItem={({ owner, workspace, error, pending }, _index, { close }) => (
            <article className="workspace-card" aria-label={`${owner.name} workspace`}>
              <div className="workspace-card-top">
                <div>
                  <h3>{owner.name}</h3>
                  <p>{owner.role}</p>
                </div>
                <Badge>{owner.status}</Badge>
              </div>
              {error ? (
                <p className="field-error">
                  Saved records need recovery. Open the workspace to review them.
                </p>
              ) : (
                <dl className="workspace-card-counts">
                  <div>
                    <dt>Leads & clients</dt>
                    <dd>{workspace.data.Clients.length}</dd>
                  </div>
                  <div>
                    <dt>Contacts</dt>
                    <dd>{workspace.data.Contacts.length}</dd>
                  </div>
                  <div>
                    <dt>Properties</dt>
                    <dd>{workspace.data.Properties.length}</dd>
                  </div>
                  <div>
                    <dt>Follow-ups & viewings</dt>
                    <dd>{workspace.data['Follow-ups'].length + workspace.data.Viewings.length}</dd>
                  </div>
                </dl>
              )}
              {pending && <p className="field-error">Latest changes are not saved yet.</p>}
              <Button
                variant={owner.id === current.id ? 'light' : 'primary'}
                onClick={() => {
                  close();
                  openWorkspace(owner.id);
                }}
                aria-label={`Open ${owner.name} workspace`}
              >
                {owner.id === current.id ? 'Continue in workspace' : 'Open workspace'}
              </Button>
            </article>
          )}
          after={!matching.length && <p className="empty">No workspaces match your search.</p>}
        />
      </section>
    </div>
  );
}
