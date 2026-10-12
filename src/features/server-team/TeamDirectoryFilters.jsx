import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { STATUS_LABELS } from './teamDirectoryModel.js';
import './directory-filters.css';

export function TeamDirectoryFilters({ directory, roles, canReviewArchive, frozen, busy }) {
  const { filters, counts, change, reset } = directory;
  const statuses = frozen ? ['archived'] : Object.keys(STATUS_LABELS)
    .filter((key) => canReviewArchive || key !== 'archived');
  const hasFilters = filters.query || filters.role !== 'all' ||
    filters.status !== (frozen ? 'archived' : 'current') || filters.sort !== 'asc';
  return (
    <section className="panel connected-directory-filters" aria-label="Filter accounts">
      <div className="connected-directory-controls">
        <div className="field">
          <label htmlFor="team-search">Search team</label>
          <input id="team-search" type="search" value={filters.query}
            onChange={(event) => change('query', event.target.value)}
            placeholder="Name, email or phone" />
        </div>
        <div className="field">
          <label htmlFor="team-role">Role</label>
          <select id="team-role" value={filters.role}
            onChange={(event) => change('role', event.target.value)}>
            <option value="all">All roles</option>
            <option value="admin">Admins</option>
            <option value="staff">Staff</option>
            <optgroup label="Staff positions">
              {roles.map((role) => <option key={role.id} value={`position:${role.id}`}>
                {role.label}
              </option>)}
            </optgroup>
          </select>
        </div>
        <div className="field">
          <label htmlFor="team-sort">Sort by</label>
          <select id="team-sort" value={filters.sort}
            onChange={(event) => change('sort', event.target.value)}>
            <option value="asc">Name A–Z</option>
            <option value="desc">Name Z–A</option>
          </select>
        </div>
        {hasFilters && <Button variant="light" onClick={reset}>Clear filters</Button>}
      </div>
      <div className="connected-directory-statuses" role="group" aria-label="Account status">
        {statuses.map((status) => (
          <button key={status} type="button" disabled={busy}
            aria-label={STATUS_LABELS[status]} aria-describedby={`team-count-${status}`}
            aria-pressed={filters.status === status}
            onClick={() => change('status', status)}>
            {STATUS_LABELS[status]}
            <span id={`team-count-${status}`}>{counts[status]}</span>
          </button>
        ))}
      </div>
      <p className="muted connected-directory-filter-note">
        Counts reflect your search and role filter. Archived accounts are excluded from All current.
      </p>
    </section>
  );
}
