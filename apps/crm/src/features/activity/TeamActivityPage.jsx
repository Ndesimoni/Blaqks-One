import React, { useState } from 'react';
import { useSession } from '../../hooks/useSession.js';
import { useTeam } from '../../hooks/useTeam.js';
import { useWorkspaceOverview } from '../../hooks/useWorkspaceOverview.js';
import { useWorkspaceScope } from '../../hooks/useWorkspaceScope.js';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { activityActions, selectActivity } from './model.js';
import { MAX_ACTIVITY_ENTRIES } from '../../config/workspaces.js';
import { MODS } from '../../lib/schema.js';
import { canVisit } from '../team/model.js';

const emptyFilters = {
  actor: '',
  workspace: '',
  action: '',
  module: '',
  query: '',
  from: '',
  to: '',
};

export function TeamActivityPage() {
  const { user } = useSession();
  const { team } = useTeam();
  const { snapshots, refresh } = useWorkspaceOverview();
  const { openWorkspace } = useWorkspaceScope();
  const [filters, setFilters] = useState(emptyFilters);
  const change = (key, value) => setFilters((previous) => ({ ...previous, [key]: value }));
  const invalidRange = filters.from && filters.to && filters.from > filters.to;
  const events = invalidRange
    ? []
    : selectActivity(snapshots, filters).filter(
        (entry) => user.managesTeam || canVisit(user, entry.module),
      );
  const unavailable = snapshots.filter((item) => item.error);
  const pending = snapshots.some((item) => item.pending);
  return (
    <div className="page-stack">
      <div className="team-notice">
        <Icon name="clock" size={18} />
        <p>
          {user.managesTeam
            ? 'Showing activity across all member workspaces.'
            : 'Showing activity in your own workspace.'}{' '}
          This browser keeps the latest {MAX_ACTIVITY_ENTRIES} actions per workspace. Message
          previews are labelled “not sent”.
        </p>
      </div>
      {unavailable.length > 0 && (
        <p className="field-error" role="status">
          {unavailable.length} workspace histories need recovery and are excluded. Open the
          workspace directory to review them.
        </p>
      )}
      {pending && (
        <p className="field-error" role="status">
          Some recent activity is still in memory because workspace saving failed.
        </p>
      )}
      <section className="panel activity-panel">
        <div className="workspace-directory-heading">
          <div>
            <h2>{user.managesTeam ? 'Team activity history' : 'My workspace activity'}</h2>
            <p>{events.length} matching actions · Dubai time</p>
          </div>
          <Button variant="light" onClick={refresh}>
            Refresh activity
          </Button>
        </div>
        <div className="activity-filters">
          <label className="activity-search">
            Search activity
            <input
              value={filters.query}
              onChange={(event) => change('query', event.target.value)}
              placeholder="Search person, record or action"
            />
          </label>
          {user.managesTeam && (
            <>
              <label>
                Workspace
                <select
                  aria-label="Workspace"
                  value={filters.workspace}
                  onChange={(event) => change('workspace', event.target.value)}
                >
                  <option value="">All workspaces</option>
                  {snapshots.map(({ owner }) => (
                    <option value={owner.id} key={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Member
                <select
                  aria-label="Member"
                  value={filters.actor}
                  onChange={(event) => change('actor', event.target.value)}
                >
                  <option value="">All members</option>
                  {team.members.map((member) => (
                    <option value={member.id} key={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label>
            Action
            <select
              aria-label="Action"
              value={filters.action}
              onChange={(event) => change('action', event.target.value)}
            >
              <option value="">All actions</option>
              {Object.entries(activityActions).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            CRM section
            <select
              aria-label="CRM section"
              value={filters.module}
              onChange={(event) => change('module', event.target.value)}
            >
              <option value="">All sections</option>
              {[...Object.keys(MODS), 'Messages', 'Workspace'].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            From date
            <input
              type="date"
              value={filters.from}
              onChange={(event) => change('from', event.target.value)}
            />
          </label>
          <label>
            To date
            <input
              type="date"
              value={filters.to}
              onChange={(event) => change('to', event.target.value)}
            />
          </label>
          <Button variant="light" onClick={() => setFilters(emptyFilters)}>
            Clear filters
          </Button>
        </div>
        {invalidRange && (
          <p className="field-error" role="alert">
            Choose an end date on or after the start date.
          </p>
        )}
        <OverflowList
          mode="scroll"
          className="activity-results-list"
          key={JSON.stringify(filters)}
          items={events}
          label="Workspace activity"
          getKey={(entry) => `${entry.workspaceId}:${entry.id}`}
          listClassName="activity-list"
          renderItem={(entry, _index, { close }) => (
            <article className="activity-entry">
              <div className="activity-entry-heading">
                <strong>{entry.actorName}</strong>
                <time dateTime={entry.at}>
                  {new Intl.DateTimeFormat('en-AE', {
                    timeZone: 'Asia/Dubai',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(entry.at))}
                </time>
              </div>
              <h3>{activityActions[entry.action]}</h3>
              <p>
                {entry.module}
                {entry.recordId ? ` · ${entry.recordId}` : ''}
                {entry.label ? ` · ${entry.label}` : ''}
              </p>
              <small>{entry.workspaceName}’s workspace</small>
              {!!entry.fields?.length && (
                <p className="activity-changes">Changed: {entry.fields.join(', ')}</p>
              )}
              {canVisit(user, entry.module) &&
                (MODS[entry.module] || entry.module === 'Messages') && (
                  <Button
                    variant="light"
                    onClick={() => {
                      close();
                      openWorkspace(entry.workspaceId, entry.module);
                    }}
                  >
                    Open CRM section
                  </Button>
                )}
            </article>
          )}
          after={
            !events.length && (
              <div className="empty">
                <Icon name="clock" size={28} />
                <h3>No matching activity yet</h3>
                <p>Record changes and completed message previews will appear here.</p>
              </div>
            )
          }
        />
      </section>
    </div>
  );
}
