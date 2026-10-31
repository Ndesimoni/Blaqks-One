import React from 'react';
import { Link } from 'react-router-dom';

export function TeamArchiveCard({ member }) {
  return (
    <article className="panel connected-team-card">
      <h2>{member.name}</h2>
      <span>Archived · Sign-in blocked</span>
      {member.deletedAt && <p>Archived {new Date(member.deletedAt).toLocaleDateString('en-AE')}</p>}
      <p>{member.email}</p>
      <p>{member.phone}</p>
      <p>
        {member.roleId === 'admin' ? 'Admin · Archived workspace' : 'Staff · Saved team membership'}
      </p>
      <p className="muted">
        Records and account history are retained. This account cannot be changed.
      </p>
      {member.roleId === 'admin' && (
        <Link
          className="btn btn-light"
          to={`/clients?workspace=${encodeURIComponent(member.workspaceId)}`}
        >
          View archived records
        </Link>
      )}
    </article>
  );
}
