import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import {
  channelLabels,
  permissionSummary,
  positionLabel,
  recordScopeLabel,
} from './profileModel.js';

function Chips({ items, label, empty }) {
  if (!items.length) return <span className="acct-muted">{empty}</span>;
  return (
    <ul className="acct-chips" aria-label={label}>
      {items.map((item) => (
        <li className="acct-chip" key={item}>
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Read-only account facts. Email, role and access are managed by the member's Admin. */
export function AccountSummary({ account }) {
  const { user, team } = account;
  const owner = user.roleId === 'super-admin';
  const positions = (user.positions || []).map(positionLabel);
  return (
    <div className="panel acct-card">
      <dl className="acct-list">
        <div className="acct-item">
          <dt>Email</dt>
          <dd>
            <span className="acct-value">{user.email}</span>
            <span className="acct-locked">
              <Icon name="lock" size={13} />
              {owner ? 'Email changes are not available yet.' : 'Contact your Admin to change.'}
            </span>
          </dd>
        </div>
        <div className="acct-item">
          <dt>Role</dt>
          <dd>
            {user.role}
            {positions.length > 0 && <span className="acct-muted"> · {positions.join(', ')}</span>}
          </dd>
        </div>
        <div className="acct-item">
          <dt>Team</dt>
          <dd>{team.ownerName}</dd>
        </div>
        <div className="acct-item">
          <dt>Sections</dt>
          <dd>
            <Chips items={permissionSummary(user)} label="Sections you can open" empty="None yet" />
          </dd>
        </div>
        <div className="acct-item">
          <dt>Records</dt>
          <dd>{recordScopeLabel(user)}</dd>
        </div>
        <div className="acct-item">
          <dt>Messaging</dt>
          <dd>
            <Chips items={channelLabels(user)} label="Messaging channels" empty="None" />
          </dd>
        </div>
      </dl>
      {!owner && (
        <p className="acct-card-foot acct-note">
          <Icon name="info" size={15} />
          Your Admin manages your email, role, positions and access. You can edit your name and
          phone below.
        </p>
      )}
    </div>
  );
}
