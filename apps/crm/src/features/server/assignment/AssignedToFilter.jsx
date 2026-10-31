import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { queueLabel } from './assignmentModel.js';

/** Team-scope "Assigned to" filter for the page toolbar; filters already-visible records. */
export function AssignedToFilter({ module, filter, onChange, assignees, me, count, onBulk }) {
  const id = useId();
  const { people, loading, error } = assignees;
  return (
    <div className="assigned-filter" role="group" aria-label="Assignment">
      <label htmlFor={id}>Assigned to</label>
      <select id={id} value={filter} onChange={(event) => onChange(event.target.value)}>
        <option value="">Everyone</option>
        <option value="queue">
          {module === 'Follow-ups' ? 'Unassigned (no holder)' : queueLabel}
        </option>
        {filter && filter !== 'queue' && !people.some((person) => person.id === filter) && (
          <option value={filter}>Selected member</option>
        )}
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.id === me ? `${person.name} (you)` : person.name}
          </option>
        ))}
      </select>
      {(loading || error) && (
        <small className="assignment-hint" role="status">
          {loading ? 'Loading team members…' : 'Team members could not be loaded.'}
        </small>
      )}
      {filter && (
        <>
          <span className="assigned-filter-count" role="status">
            {count} {count === 1 ? 'record' : 'records'}
          </span>
          {onBulk && (
            <Button variant="light" icon="users" disabled={!count} onClick={onBulk}>
              Reassign all
            </Button>
          )}
        </>
      )}
    </div>
  );
}
