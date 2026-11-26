import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { useTeam } from '../../hooks/useTeam.js';

export function UserAccount() {
  const { user } = useSession();
  const { team } = useTeam();
  const { fileBusy } = useWorkspaceActions();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const signOutRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    signOutRef.current?.focus();
    const outside = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div
      className="account-control"
      ref={containerRef}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
          setOpen(false);
      }}
    >
      <button
        className="user-button"
        type="button"
        ref={triggerRef}
        aria-label={`Account for ${user.name}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((previous) => !previous);
          setError('');
        }}
      >
        <span>{user.name.slice(0, 1).toUpperCase()}</span>
        <strong>{user.name}</strong>
        <Icon name="down" size={14} />
      </button>
      {open && (
        <section className="account-panel" id={panelId} aria-label="Admin account">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
          <div className="account-role">
            <Icon name="shield" size={14} /> {user.role} ·{' '}
            {Object.values(user.permissions).every(Boolean) ? 'Full access' : 'Assigned access'}
          </div>
          <Link className="account-link" to="/my-profile">
            My profile & messaging
          </Link>
          {(!team.configured || user.managesTeam) && (
            <Link className="account-link" to="/team-access">
              Team & access
            </Link>
          )}
          <Link
            to="/sign-out"
            className="account-sign-out"
            ref={signOutRef}
            onClick={(event) => {
              if (fileBusy) {
                event.preventDefault();
                setError('Please wait until the file operation finishes.');
                return;
              }
              setOpen(false);
            }}
          >
            <Icon name="logout" size={17} /> Sign out
          </Link>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
