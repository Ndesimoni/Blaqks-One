import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { avatarTone, formatStamp, initials, positionLabel } from './profileModel.js';
import { relativeTime } from './sessionModel.js';

/** Identity summary: avatar, name, email, role and positions, team and password age. */
export function ProfileHeader({ account }) {
  const { user, team, passwordChangedAt } = account;
  const positions = user.positions || [];
  return (
    <section className="panel acct-header" aria-label="Your account">
      <span className="acct-avatar" data-tone={avatarTone(user.id)} aria-hidden="true">
        {initials(user.name)}
      </span>
      <div className="acct-identity">
        <p className="acct-name">{user.name}</p>
        <p className="acct-email">{user.email}</p>
        <ul className="acct-chips" aria-label="Role and positions">
          <li className="acct-chip acct-chip-role">{user.role}</li>
          {positions.map((position) => (
            <li className="acct-chip" key={position}>
              {positionLabel(position)}
            </li>
          ))}
        </ul>
      </div>
      <dl className="acct-header-meta">
        <div>
          <dt>
            <Icon name="users" size={15} />
            Team
          </dt>
          <dd>{team.ownerName}</dd>
        </div>
        <div>
          <dt>
            <Icon name="lock" size={15} />
            Password
          </dt>
          {passwordChangedAt ? (
            <dd title={formatStamp(passwordChangedAt)}>
              Last changed {relativeTime(passwordChangedAt)}
            </dd>
          ) : (
            <dd>Not changed since your account was set up</dd>
          )}
        </div>
      </dl>
    </section>
  );
}
