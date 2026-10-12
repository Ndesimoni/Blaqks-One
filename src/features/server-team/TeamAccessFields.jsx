import React from 'react';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { TeamAccountStatus } from './TeamAccountStatus.jsx';
import { TeamChannelFields } from './TeamChannelFields.jsx';
import { accessFields, positionDefaults } from './model.js';

export function TeamAccessFields({ form, change, roles, member, busy }) {
  const togglePosition = (id, checked) => {
    const positions = checked
      ? [...form.positions, id]
      : form.positions.filter((value) => value !== id);
    change('positions', positions, { permissions: positionDefaults(positions, roles).permissions });
  };
  if (form.accountRole === 'admin')
    return (
      <>
        <section>
          <h3>Admin access</h3>
          <p>
            This person manages their own workspace and team. They cannot create another Admin or
            Super Admin.
          </p>
        </section>
        {member && <TeamAccountStatus form={form} change={change} member={member} busy={busy} />}
        <TeamChannelFields form={form} change={change} busy={busy} />
      </>
    );
  return (
    <div className="team-fields">
      <fieldset className="connected-team-options">
        <legend>Positions *</legend>
        <p>
          Select all positions this person handles. Changing positions applies their combined
          defaults; you can adjust access below.
        </p>
        <OverflowList
          mode="scroll"
          items={roles}
          getKey={(role) => role.id}
          label="Team positions"
          className="connected-team-role-list"
          renderItem={(role) => (
            <label>
              <input
                type="checkbox"
                checked={form.positions.includes(role.id)}
                disabled={busy}
                onChange={(event) => togglePosition(role.id, event.target.checked)}
              />
              {role.label}
            </label>
          )}
        />
      </fieldset>
      <fieldset className="connected-team-options">
        <legend>CRM access</legend>
        {accessFields.map(([key, label, guidance]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={form.permissions[key]}
              disabled={busy}
              onChange={(event) =>
                change('permissions', { ...form.permissions, [key]: event.target.checked })
              }
            />
            <span>
              {label}
              <small>{guidance}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <TeamChannelFields form={form} change={change} busy={busy} />
      {member && <TeamAccountStatus form={form} change={change} member={member} busy={busy} />}
    </div>
  );
}
