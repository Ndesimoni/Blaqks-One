import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { queueLabel } from './assignmentModel.js';

/** Native picker of eligible members; the queue option is offered only to team scope. */
export function AssigneeSelect({
  id,
  module,
  assignees,
  value,
  onChange,
  allowQueue,
  current,
  me,
}) {
  const { people, loading, error, retry } = assignees;
  if (error)
    return (
      <div role="alert" className="assignment-load-error">
        <p className="field-error">{error}</p>
        <Button variant="light" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  return (
    <div className="field">
      <label htmlFor={id}>
        New assignee<span className="required"> *</span>
      </label>
      <select
        id={id}
        value={value}
        required
        disabled={loading}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{loading ? 'Loading team members…' : 'Choose a team member'}</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.id === me ? `${person.name} (you)` : person.name}
            {person.id === current ? ' · current' : ''}
          </option>
        ))}
        {allowQueue && (
          <option value="queue">
            {module === 'Follow-ups' ? 'No direct assignee (follows the client)' : queueLabel}
          </option>
        )}
      </select>
    </div>
  );
}
