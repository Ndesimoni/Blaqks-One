import React, { useRef } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { STATUS_OPTION_LABELS } from './teamDirectoryModel.js';
import './directory-filters.css';

export function TeamDirectoryFilters({ directory, roles, canReviewArchive, frozen, busy }) {
  const { filters, counts, hasFilters, change, reset } = directory;
  const searchRef = useRef(null);
  const statuses = frozen
    ? ['archived']
    : Object.keys(STATUS_OPTION_LABELS).filter((key) => canReviewArchive || key !== 'archived');
  const clear = () => {
    reset();
    searchRef.current?.focus();
  };
  return (
    <section className="panel connected-directory-filters" aria-label="Filter accounts">
      <div className="connected-directory-controls">
        <div className="field connected-directory-search">
          <label htmlFor="team-search">Search team</label>
          <input
            ref={searchRef}
            id="team-search"
            type="search"
            value={filters.query}
            onChange={(event) => change('query', event.target.value)}
            placeholder="Name, email or phone"
          />
        </div>
        <div className="field connected-directory-status">
          <label htmlFor="team-status">Account status</label>
          <select
            id="team-status"
            value={filters.status}
            disabled={busy || frozen}
            aria-describedby="team-status-note"
            onChange={(event) => change('status', event.target.value)}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {`${STATUS_OPTION_LABELS[status]} (${counts[status]})`}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="team-role">Role</label>
          <select
            id="team-role"
            value={filters.role}
            onChange={(event) => change('role', event.target.value)}
          >
            <option value="all">All roles</option>
            <option value="admin">Admins</option>
            <option value="staff">Staff</option>
            <optgroup label="Staff positions">
              {roles.map((role) => (
                <option key={role.id} value={`position:${role.id}`}>
                  {role.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div className="field">
          <label htmlFor="team-sort">Sort by</label>
          <select
            id="team-sort"
            value={filters.sort}
            onChange={(event) => change('sort', event.target.value)}
          >
            <option value="asc">Name A–Z</option>
            <option value="desc">Name Z–A</option>
          </select>
        </div>
        <Button
          variant="light"
          className="connected-directory-clear"
          onClick={clear}
          disabled={!hasFilters}
        >
          Clear filters
        </Button>
      </div>
      <p id="team-status-note" className="muted connected-directory-filter-note">
        Counts reflect your search and role. All current excludes archived accounts.
      </p>
    </section>
  );
}
