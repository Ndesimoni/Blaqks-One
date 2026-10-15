import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { deviceLabel, formatStamp } from './profileModel.js';

function SessionRow({ session, busy, onRevoke }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="profile-session">
      <div>
        <strong>
          {deviceLabel(session)}
          {session.current && <span className="profile-badge">This device</span>}
        </strong>
        <small>
          Signed in {formatStamp(session.createdAt)} · Last active {formatStamp(session.lastSeenAt)}
        </small>
      </div>
      {!session.current &&
        (confirming ? (
          <div className="profile-confirm" role="group" aria-label="Confirm sign out">
            <span>Sign out this device?</span>
            <Button variant="danger-light" disabled={busy} onClick={() => onRevoke(session.id)}>
              Sign out device
            </Button>
            <Button variant="light" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="light" disabled={busy} onClick={() => setConfirming(true)}>
            Sign out
          </Button>
        ))}
    </li>
  );
}

export function SessionsPanel({ state }) {
  const { sessions, error, status, busy, reload, revoke, revokeOthers } = state;
  const [confirmAll, setConfirmAll] = useState(false);
  const others = sessions?.filter((session) => !session.current).length || 0;
  return (
    <section className="panel profile-panel" aria-labelledby="profile-sessions-title">
      <div className="profile-panel-head">
        <h2 id="profile-sessions-title">Active sessions</h2>
        {others > 0 && !confirmAll && (
          <Button variant="light" disabled={busy} onClick={() => setConfirmAll(true)}>
            Sign out all other devices
          </Button>
        )}
      </div>
      {confirmAll && others > 0 && (
        <div
          className="profile-confirm"
          role="group"
          aria-label="Confirm sign out of other devices"
        >
          <span>Sign out {others === 1 ? 'the other device' : `all ${others} other devices`}?</span>
          <Button
            variant="danger-light"
            disabled={busy}
            onClick={() => revokeOthers().then(() => setConfirmAll(false))}
          >
            Sign out other devices
          </Button>
          <Button variant="light" disabled={busy} onClick={() => setConfirmAll(false)}>
            Cancel
          </Button>
        </div>
      )}
      <div aria-live="polite" className="profile-status">
        {status && <p className="profile-success">{status}</p>}
      </div>
      {error && (
        <div className="profile-alert" role="alert">
          <p className="field-error">{error}</p>
          <Button variant="light" onClick={reload}>
            Retry
          </Button>
        </div>
      )}
      {!sessions && !error && <p role="status">Loading sessions…</p>}
      {sessions && (
        <ul className="profile-sessions" aria-label="Signed-in devices">
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} busy={busy} onRevoke={revoke} />
          ))}
        </ul>
      )}
    </section>
  );
}
