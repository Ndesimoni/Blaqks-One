import React, { useId } from 'react';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useArchiveAccount } from './useArchiveAccount.js';

export function TeamArchiveDialog({ workspaceId, member, onClose, onArchived }) {
  const titleId = useId();
  const inputId = useId();
  const flow = useArchiveAccount(workspaceId, member, onArchived);
  const close = () => {
    if (!flow.busy) onClose({ refresh: Boolean(flow.error) });
  };
  const reviewed = flow.preview?.member;
  return (
    <Drawer titleId={titleId} onClose={close}>
      <div className="drawer-top">
        <div>
          <h2 id={titleId} tabIndex={-1} data-initial-focus>
            Delete account
          </h2>
          <p>Archive {member.name} without erasing their data.</p>
        </div>
        <Button variant="light" disabled={flow.busy} onClick={close}>
          Close
        </Button>
      </div>
      <form className="connected-team-form" onSubmit={flow.submit}>
        <div className="drawer-body">
          {flow.loading && <p role="status">Reviewing account and saved records…</p>}
          {flow.error && (
            <div role="alert">
              <p className="field-error">{flow.error}</p>
              <p>Close this review to refresh Team and check whether the account was archived.</p>
            </div>
          )}
          {!flow.loading && !flow.preview && (
            <Button variant="light" onClick={flow.retry} disabled={flow.busy}>
              Review again
            </Button>
          )}
          {reviewed && (
            <>
              <dl className="connected-team-review">
                <dt>Account</dt>
                <dd>{reviewed.name}</dd>
                <dt>{reviewed.roleId === 'admin' ? 'Saved records' : 'Workspace records'}</dt>
                <dd>{flow.preview.recordCount} retained</dd>
                {reviewed.roleId === 'admin' && (
                  <>
                    <dt>Team accounts</dt>
                    <dd>{flow.preview.teamCount} also archived</dd>
                  </>
                )}
              </dl>
              <p>
                This account will leave the current account list. Existing sessions and invitation
                links will end immediately. Archived data is read-only for the Super Admin.
              </p>
              <p>
                {reviewed.roleId === 'admin'
                  ? 'This Admin and their entire team will lose access. Their workspace and all its records stay saved.'
                  : 'Only this staff account loses access. The team workspace and its records stay available.'}
              </p>
              <p>
                Archived accounts stay read-only and cannot be restored. No saved data is erased.
              </p>
              <div className="field">
                <label htmlFor={inputId}>Type {reviewed.email} to confirm</label>
                <input
                  id={inputId}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={flow.confirmation}
                  disabled={flow.busy}
                  onChange={(event) => flow.setConfirmation(event.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <div className="drawer-footer">
          <Button variant="light" disabled={flow.busy} onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger-light"
            disabled={flow.busy || !reviewed || flow.confirmation !== reviewed.email}
          >
            {flow.busy ? 'Archiving…' : 'Delete and archive'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
