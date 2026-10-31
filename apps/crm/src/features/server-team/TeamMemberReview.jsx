import React from 'react';
import { accessFields, channelFields, recordScopeOptions } from './model.js';
import { TeamActionReview } from './TeamActionReview.jsx';

/** One labelled review group; groups are divided so each answer sits beside its heading. */
function ReviewGroup({ title, children }) {
  return (
    <div className="connected-team-review-group">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

export function TeamMemberReview({ form, roles, editing }) {
  const names = form.positions.map((id) => roles.find((role) => role.id === id)?.label || id);
  return (
    <section className="team-fields connected-team-review-step">
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
          <ReviewGroup title="Positions">
            <p>{names.join(', ')}</p>
          </ReviewGroup>
          <ReviewGroup title="CRM access">
            <p>
              {accessFields
                .filter(([key]) => form.permissions[key])
                .map(([, label]) => label)
                .join(', ') || 'No sections assigned'}
            </p>
          </ReviewGroup>
          {editing && (
            <ReviewGroup title="Record visibility">
              <p>{recordScopeOptions.find(([value]) => value === form.recordScope)?.[1]}</p>
            </ReviewGroup>
          )}
          <ReviewGroup title="Record actions">
            <TeamActionReview form={form} />
          </ReviewGroup>
        </>
      )}
      <ReviewGroup title="Messaging permissions">
        <p>
          {channelFields
            .filter(([key]) => form.channelAccess[key])
            .map(([, label]) => label)
            .join(', ') || 'Restricted'}
        </p>
      </ReviewGroup>
      <p className="connected-team-review-note">
        {editing
          ? 'Changes apply to this account immediately.'
          : 'You will receive a private activation link to share with this person. They choose their own password. No invitation email is sent automatically.'}
      </p>
    </section>
  );
}
