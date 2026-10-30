import React, { useId, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { WorkspacePickerResults } from './WorkspacePickerResults.jsx';
import { filterWorkspaces } from './workspacePickerModel.js';

export function WorkspacePickerDialog({ owner, workspaces, busy, onSelect, onClose }) {
  const titleId = useId();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const matches = useMemo(() => filterWorkspaces(workspaces, query), [workspaces, query]);
  return (
    <Drawer titleId={titleId} className="workspace-picker-dialog" onClose={onClose}>
      <div className="drawer-top">
        <div>
          <div className="eyebrow">SUPER ADMIN</div>
          <h2 id={titleId}>Choose workspace</h2>
          <p>Open a current team or review an archived workspace.</p>
        </div>
        <button className="icon-btn" aria-label="Close workspace selector" onClick={onClose}>
          <Icon name="close" size={21} />
        </button>
      </div>
      <div className="drawer-body workspace-picker-body">
        <div className="field workspace-picker-search">
          <label htmlFor={searchId}>Search workspaces</label>
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder="Search by name or status"
            autoComplete="off"
            data-initial-focus
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <p className="workspace-picker-count" role="status">
          {matches.length} of {workspaces.length} workspaces
        </p>
        {matches.length ? (
          <OverflowList
            items={matches}
            mode="scroll"
            label="Workspaces"
            getKey={(workspace) => workspace.id}
            className="workspace-picker-collection"
            renderList={(entries) => (
              <WorkspacePickerResults
                workspaces={entries.map(({ item }) => item)}
                owner={owner}
                busy={busy}
                onSelect={onSelect}
              />
            )}
          />
        ) : (
          <div className="empty workspace-picker-empty">
            <h3>{query.trim() ? 'No matching workspaces' : 'No workspaces available'}</h3>
            <p>
              {query.trim() ? 'Try another name or clear your search.' : 'Refresh to try again.'}
            </p>
            {query && (
              <Button variant="light" onClick={() => setQuery('')}>
                Clear search
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="drawer-footer">
        <p className="workspace-picker-note">Archived workspaces are read-only.</p>
        <Button variant="light" onClick={onClose}>
          Close
        </Button>
      </div>
    </Drawer>
  );
}
