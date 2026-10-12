import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { TeamMemberCard } from './TeamMemberCard.jsx';
import { TeamDirectoryTable } from './TeamDirectoryTable.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import './directory-results.css';

export function TeamDirectoryResults({
  team,
  owner,
  filtered,
  query,
  archived,
  current,
  onPage,
  onEdit,
  actions,
  onDelete,
}) {
  const mobile = useMediaQuery('(max-width: 850px)');
  const members = filtered.slice(current * 12, (current + 1) * 12);
  if (team.loading) return <p role="status">Loading team…</p>;
  if (team.error)
    return (
      <section className="panel">
        <p className="field-error" role="alert">
          {team.error}
        </p>
        <Button onClick={team.retry}>Retry</Button>
      </section>
    );
  return (
    <>
      {!filtered.length && (
        <section className="panel">
          <h2>
            {query
              ? 'No matching teammates'
              : archived
                ? 'No archived accounts'
                : 'Build your team'}
          </h2>
          <p>
            {query
              ? 'Try another name or clear your search.'
              : archived
                ? 'Archived accounts will appear here when an account is deleted.'
                : 'Invite your first teammate and choose their positions and access.'}
          </p>
        </section>
      )}
      {members.length > 0 &&
        (mobile ? (
          <div className="connected-team-grid">
            {members.map((member) => (
              <TeamMemberCard
                key={member.id}
                member={member}
                roles={team.roles}
                owner={owner}
                archived={archived}
                onEdit={onEdit}
                actions={actions}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          <TeamDirectoryTable
            members={members}
            roles={team.roles}
            owner={owner}
            archived={archived}
            actions={actions}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      <Pagination
        total={filtered.length}
        page={current}
        label="Team pages"
        itemLabel="teammates"
        onChange={onPage}
      />
    </>
  );
}
