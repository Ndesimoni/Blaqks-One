import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { memberStatus } from './model.js';

export function TeamMemberTable({ members, roles, label, onManage }) {
  return (
    <div className="team-table-scroll">
      <table className="team-table">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            <th>Member</th>
            <th>Phone & updates</th>
            <th>Role</th>
            <th>Client messaging</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Manage member</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>
                <div className="team-member-name">
                  <span className="avatar">{member.name[0].toUpperCase()}</span>
                  <div>
                    <strong>{member.name}</strong>
                    <small>{member.email}</small>
                    {member.pendingEmail && <small>New email awaiting preview verification</small>}
                  </div>
                </div>
              </td>
              <td>
                <strong>{member.phone || 'Needed at activation'}</strong>
                <small>
                  {member.whatsappUpdates
                    ? 'WhatsApp work updates enabled'
                    : 'WhatsApp work updates off'}
                </small>
              </td>
              <td>{roles.find((role) => role.id === member.roleId)?.name}</td>
              <td>
                <div className="team-channel-pills">
                  <span className={member.channelAccess.whatsapp ? 'allowed' : ''}>
                    WhatsApp {member.channelAccess.whatsapp ? '✓' : '—'}
                  </span>
                  <span className={member.channelAccess.email ? 'allowed' : ''}>
                    Email {member.channelAccess.email ? '✓' : '—'}
                  </span>
                </div>
              </td>
              <td>
                <Badge>
                  {memberStatus(member)[0].toUpperCase() + memberStatus(member).slice(1)}
                </Badge>
              </td>
              <td>
                <button
                  type="button"
                  className="team-manage-button"
                  aria-label={`Manage ${member.name}`}
                  onClick={() => onManage(member.id)}
                >
                  <Icon name="more" size={20} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!members.length && (
        <div className="empty">
          <h3>No matching members</h3>
          <p>Try another name, email or status.</p>
        </div>
      )}
    </div>
  );
}
