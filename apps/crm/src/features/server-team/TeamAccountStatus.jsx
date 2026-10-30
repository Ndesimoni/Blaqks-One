import React from 'react';

export function TeamAccountStatus({ form, change, member, busy }) {
  if (member.invitationPending && member.status !== 'invited')
    return (
      <p>
        Invitation inactive. Renew the invitation from this person's card to send a new activation
        link.
      </p>
    );
  return (
    <fieldset className="connected-team-options">
      <legend>Account status</legend>
      <label>
        <input
          type="checkbox"
          checked={form.active || (member.status === 'invited' && !form.cancelInvitation)}
          disabled={busy}
          onChange={(event) =>
            change('active', event.target.checked, { cancelInvitation: !event.target.checked })
          }
        />
        {member.status === 'invited' ? 'Keep invitation active' : 'Account active'}
      </label>
      <small>
        Deactivation ends access and existing sessions. A cancelled invitation cannot be used.
      </small>
    </fieldset>
  );
}
