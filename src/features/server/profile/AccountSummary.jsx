import React from 'react';
import {
  channelSummary,
  formatStamp,
  permissionSummary,
  positionLabel,
  recordScopeLabel,
} from './profileModel.js';

/** Read-only account facts. Email, role and access are managed by the member's Admin. */
export function AccountSummary({ account }) {
  const { user, team, passwordChangedAt } = account;
  const sections = permissionSummary(user);
  const owner = user.roleId === 'super-admin';
  return (
    <section className="panel profile-panel" aria-labelledby="profile-account-title">
      <h2 id="profile-account-title">Account details</h2>
      <dl className="connected-team-review profile-facts">
        <dt>Email</dt>
        <dd>
          {user.email}
          <small>
            {owner ? 'Email changes are not available yet.' : 'Contact your Admin to change.'}
          </small>
        </dd>
        <dt>Role</dt>
        <dd>{user.role}</dd>
        {user.positions?.length > 0 && (
          <>
            <dt>Positions</dt>
            <dd>{user.positions.map(positionLabel).join(', ')}</dd>
          </>
        )}
        <dt>Team</dt>
        <dd>{team.ownerName}</dd>
        <dt>Sections</dt>
        <dd>{sections.length ? sections.join(', ') : 'None yet'}</dd>
        <dt>Records</dt>
        <dd>{recordScopeLabel(user)}</dd>
        <dt>Messaging</dt>
        <dd>{channelSummary(user)}</dd>
        <dt>Password</dt>
        <dd>
          {passwordChangedAt
            ? `Last changed ${formatStamp(passwordChangedAt)}`
            : 'Not changed since your account was set up'}
        </dd>
      </dl>
      {!owner && (
        <p className="profile-note">
          Your Admin manages your email, role, positions and access. You can edit your name and
          phone below.
        </p>
      )}
    </section>
  );
}
