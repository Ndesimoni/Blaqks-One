import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Empty } from '../../components/ui/Empty.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { TeamMemberCard } from './TeamMemberCard.jsx';
import { TeamDirectoryTable } from './TeamDirectoryTable.jsx';
import { TeamDirectorySkeleton } from './TeamDirectorySkeleton.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import './directory-results.css';
import './team-people.css';

function emptyCopy({ query, archived, hasFilters }) {
  if (query) return ['No matching teammates', 'Try another name or clear your search.', 'search'];
  if (archived)
    return [
      'No archived accounts',
      'Archived accounts will appear here when an account is deleted.',
      'layers',
    ];
  if (hasFilters)
    return [
      'No matching teammates',
      'Try another role or status, or clear your filters.',
      'filter',
    ];
  return [
    'Build your team',
    'Invite your first teammate and choose their positions and access.',
    'users',
  ];
}

export function TeamDirectoryResults({
  team,
  owner,
  filtered,
  query,
  hasFilters,
  archived,
  current,
  onPage,
  onEdit,
  actions,
  onDelete,
}) {
  const mobile = useMediaQuery('(max-width: 850px)');
  const members = filtered.slice(current * 12, (current + 1) * 12);
  if (team.loading) return <TeamDirectorySkeleton />;
  if (team.error)
    return (
      <section className="panel team-directory-error">
        <p className="field-error" role="alert">
          {team.error}
        </p>
        <Button variant="light" onClick={team.retry}>
          Retry
        </Button>
      </section>
    );
  const [title, detail, icon] = emptyCopy({ query, archived, hasFilters });
  return (
    <>
      {!filtered.length && (
        <section className="panel team-directory-empty">
          <Empty title={title} detail={detail} icon={icon} />
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
