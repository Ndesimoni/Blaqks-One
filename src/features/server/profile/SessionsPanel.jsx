import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { InlineConfirm } from './InlineConfirm.jsx';
import { SessionRow } from './SessionRow.jsx';
import { sortSessions } from './sessionModel.js';

function SessionSkeleton() {
  return (
    <ul className="acct-sessions" aria-hidden="true">
      {[0, 1].map((row) => (
        <li key={row} className="acct-session">
          <span className="acct-device acct-skeleton" />
          <div className="acct-session-main">
            <span className="acct-skeleton acct-skeleton-line" />
            <span className="acct-skeleton acct-skeleton-line short" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SessionsPanel({ state }) {
  const { sessions, error, status, busy, reload, revoke, revokeOthers } = state;
  const [confirmAll, setConfirmAll] = useState(false);
  const others = sessions?.filter((session) => !session.current).length || 0;
  const count = sessions?.length || 0;
  return (
    <div className="panel acct-card">
      <div className="acct-card-body">
        <div aria-live="polite" className="acct-status">
          {status && (
            <p className="acct-success">
              <Icon name="check" size={15} />
              {status}
            </p>
          )}
        </div>
        {error && (
          <div className="acct-alert" role="alert">
            <p className="field-error">{error}</p>
            <Button variant="light" onClick={reload}>
              Retry
            </Button>
          </div>
        )}
        {!sessions && !error && (
          <>
            <p className="sr-only" role="status">
              Loading sessions…
            </p>
            <SessionSkeleton />
          </>
        )}
        {sessions && count === 0 && <p className="acct-muted">No active sessions.</p>}
        {count > 0 && (
          <ul className="acct-sessions" aria-label="Signed-in devices">
            {sortSessions(sessions).map((session) => (
              <SessionRow key={session.id} session={session} busy={busy} onRevoke={revoke} />
            ))}
          </ul>
        )}
      </div>
      {sessions && (
        <div className="acct-card-foot">
          {confirmAll && others > 0 ? (
            <InlineConfirm
              label="Confirm sign out of other devices"
              prompt={`Sign out ${others === 1 ? 'the other device' : `all ${others} other devices`}?`}
              confirmLabel="Sign out other devices"
              busy={busy}
              onConfirm={() => revokeOthers().then(() => setConfirmAll(false))}
              onCancel={() => setConfirmAll(false)}
            />
          ) : (
            <>
              <p className="acct-muted acct-foot-status">
                {others > 0
                  ? `Signed in on ${count} devices.`
                  : 'This is your only active session.'}
              </p>
              {others > 0 && (
                <Button
                  variant="light"
                  className="acct-btn-danger"
                  icon="logout"
                  disabled={busy}
                  onClick={() => setConfirmAll(true)}
                >
                  Sign out all other devices
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
