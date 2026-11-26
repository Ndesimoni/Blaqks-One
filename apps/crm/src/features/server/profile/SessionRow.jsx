import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { InlineConfirm } from './InlineConfirm.jsx';
import { formatStamp } from './profileModel.js';
import { deviceKind, deviceLabel, relativeTime } from './sessionModel.js';

function Stamp({ value }) {
  return (
    <time dateTime={value} title={formatStamp(value)}>
      {relativeTime(value)}
    </time>
  );
}

/** One signed-in device; other devices can be signed out after an inline confirmation. */
export function SessionRow({ session, busy, onRevoke }) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef(null);
  const restore = useRef(false);
  useEffect(() => {
    if (confirming || !restore.current) return;
    restore.current = false;
    trigger.current?.querySelector('button')?.focus();
  }, [confirming]);
  const mobile = deviceKind(session) === 'mobile';
  return (
    <li className={`acct-session${session.current ? ' is-current' : ''}`}>
      <span className="acct-device" aria-hidden="true">
        <Icon name={mobile ? 'smartphone' : 'monitor'} size={20} />
      </span>
      <div className="acct-session-main">
        <p className="acct-session-title">
          <strong>{deviceLabel(session)}</strong>
          {session.current && <span className="acct-badge">This device</span>}
        </p>
        <p className="acct-session-meta">
          {session.current ? (
            <span className="acct-live">Active now</span>
          ) : (
            <span>
              Last active <Stamp value={session.lastSeenAt || session.createdAt} />
            </span>
          )}
          <span>
            Signed in <Stamp value={session.createdAt} />
          </span>
        </p>
      </div>
      {!session.current &&
        (confirming ? (
          <InlineConfirm
            label="Confirm sign out"
            prompt="Sign out this device?"
            confirmLabel="Sign out device"
            busy={busy}
            onConfirm={() => onRevoke(session.id)}
            onCancel={() => {
              restore.current = true;
              setConfirming(false);
            }}
          />
        ) : (
          <span ref={trigger} className="acct-session-action">
            <Button variant="light" disabled={busy} onClick={() => setConfirming(true)}>
              Sign out
            </Button>
          </span>
        ))}
    </li>
  );
}
