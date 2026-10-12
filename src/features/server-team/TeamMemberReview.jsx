import React from 'react';
import { accessFields, channelFields } from './model.js';

export function TeamMemberReview({ form, roles, editing }) {
  const names = form.positions.map((id) => roles.find((role) => role.id === id)?.label || id);
  return (
    <section className="team-fields">
      <h3>{editing ? 'Review changes' : 'Review invitation'}</h3>
      <dl className="connected-team-review">
        <dt>Name</dt>
        <dd>{form.name}</dd>
        <dt>Email</dt>
        <dd>{form.email}</dd>
        <dt>Phone</dt>
        <dd>{form.phone}</dd>
        <dt>Account</dt>
        <dd>
          {form.accountRole === 'admin'
            ? 'Admin · Separate workspace'
            : 'Teammate · This workspace'}
        </dd>
      </dl>
      {form.accountRole !== 'admin' && (
        <>
          <h4>Positions</h4>
          <p>{names.join(', ')}</p>
          <h4>CRM access</h4>
          <p>
            {accessFields
              .filter(([key]) => form.permissions[key])
              .map(([, label]) => label)
              .join(', ') || 'No sections assigned'}
          </p>
        </>
      )}
      <h4>Messaging permissions</h4>
      <p>
        {channelFields
          .filter(([key]) => form.channelAccess[key])
          .map(([, label]) => label)
          .join(', ') || 'Restricted'}
      </p>
      <p>
        {editing
          ? 'Changes apply to this account immediately.'
          : 'You will receive a private activation link to share with this person. They choose their own password. No invitation email is sent automatically.'}
      </p>
    </section>
  );
}
