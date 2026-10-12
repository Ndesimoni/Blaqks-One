import React from 'react';
import { Button } from '../../components/ui/Button.jsx';

export function TeamAccountActions({ member, actions }) {
  const action = member.active ? 'suspend' : 'restore';
  const label = member.active ? 'Suspend account' : 'Restore account';
  const pending = actions.pendingId === member.id;
  return (
    <div>
      <Button
        variant={member.active ? 'danger-light' : 'light'}
        disabled={!!actions.pendingId}
        onClick={() => actions[action](member)}
        aria-label={`${label} for ${member.name}`}
      >
        {pending ? (member.active ? 'Suspending…' : 'Restoring…') : label}
      </Button>
      <p className="muted">
        {member.active
          ? member.roleId === 'admin'
            ? 'Suspending blocks this Admin and their staff. Records stay saved.'
            : 'Suspending blocks sign-in and ends existing sessions. Records stay saved.'
          : 'Restore access so this person can sign in again. Saved permissions are retained.'}
      </p>
    </div>
  );
}
