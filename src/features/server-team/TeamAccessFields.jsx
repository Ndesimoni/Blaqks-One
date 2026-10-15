import React from 'react';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { TeamAccountStatus } from './TeamAccountStatus.jsx';
import { TeamChannelFields } from './TeamChannelFields.jsx';
import { TeamRecordScopeFields } from './TeamRecordScopeFields.jsx';
import { TeamActionFields } from './TeamActionFields.jsx';
import { TeamActionDefaults } from './TeamActionDefaults.jsx';
import { accessFields, positionDefaults } from './model.js';
import { actionModules, actionsAfterAccessChange } from './actionModel.js';

export function TeamAccessFields({ form, change, roles, member, busy }) {
  const togglePosition = (id, checked) => {
    const positions = checked
      ? [...form.positions, id]
      : form.positions.filter((value) => value !== id);
    const { permissions } = positionDefaults(positions, roles);
    const actions = actionsAfterAccessChange(form, permissions, positions, roles);
    change('positions', positions, { permissions, actions });
  };
  const toggleModule = (key, checked) => {
    const permissions = { ...form.permissions, [key]: checked };
    const actions = actionsAfterAccessChange(form, permissions, form.positions, roles);
    change('permissions', permissions, { actions });
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
          section defaults; sections already on keep the actions you chose below.
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
        <p>
          Choose the sections this person can open. The ticks under each section set what they can
          do there.
        </p>
        {accessFields.map(([key, label, guidance]) => (
          <React.Fragment key={key}>
            <label>
              <input
                type="checkbox"
                checked={form.permissions[key]}
                disabled={busy}
                onChange={(event) => toggleModule(key, event.target.checked)}
              />
              <span>
                {label}
                <small>{guidance}</small>
              </span>
            </label>
            {key in actionModules && form.permissions[key] && (
              <TeamActionFields
                module={key}
                label={label}
                form={form}
                change={change}
                busy={busy}
                invitation={!member}
              />
            )}
          </React.Fragment>
        ))}
        <TeamActionDefaults form={form} change={change} roles={roles} busy={busy} />
      </fieldset>
      {member && <TeamRecordScopeFields form={form} change={change} busy={busy} />}
      <TeamChannelFields form={form} change={change} busy={busy} />
      {member && <TeamAccountStatus form={form} change={change} member={member} busy={busy} />}
    </div>
  );
}
