import React from 'react';
import { Button } from '../../components/ui/Button.jsx';

export function TeamDirectoryToolbar({
  owner,
  archived,
  onInvite,
  busy,
}) {
  const frozen = owner.status === 'archived';
  return (
    <>
      <div className="panel connected-team-toolbar">
        <div>
          <h2>{owner.name} team</h2>
          <p>
            {frozen || archived
              ? 'Archived accounts are read-only. Sign-in is blocked and all saved data is retained.'
              : 'People share this workspace with the access you assign. Other Admin teams stay separate.'}
          </p>
        </div>
        {!frozen && !archived && (
          <Button icon="plus" disabled={busy} onClick={onInvite}>
            Invite teammate
          </Button>
        )}
      </div>
    </>
  );
}
