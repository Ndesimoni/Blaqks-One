import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { previewLink } from './model.js';

export function PreviewLinkDialog({ kind, member, onClose }) {
  const id = useId();
  const [message, setMessage] = useState('');
  const path = previewLink(kind, member);
  const fullLink = `${location.origin}${location.pathname}#${path}`;
  const title =
    kind === 'invite'
      ? 'Invitation preview'
      : kind === 'reset'
        ? 'Password reset preview'
        : 'Email verification preview';
  return (
    <Drawer titleId={id} className="team-preview-dialog" onClose={onClose}>
      <div className="drawer-top">
        <div>
          <div className="eyebrow">FRONTEND PREVIEW · NO MESSAGE SENT</div>
          <h2 id={id}>{title}</h2>
          <p>
            {member.name} · {member.email}
          </p>
        </div>
      </div>
      <div className="drawer-body">
        <p className="team-muted">
          Open this link to try the account flow in this browser. It has not been emailed or sent
          through WhatsApp.
        </p>
        <label className="team-link-field">
          Preview link
          <input
            aria-label="Preview link"
            readOnly
            value={fullLink}
            onFocus={(event) => event.target.select()}
          />
        </label>
        <div className="team-inline-actions">
          <Link className="btn btn-primary" to={path}>
            Open preview
          </Link>
          <Button
            variant="light"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(fullLink);
                setMessage(
                  'Preview link copied. It is available only in this browser’s demo workspace.',
                );
              } catch {
                setMessage('Select and copy the preview link above.');
              }
            }}
          >
            Copy link
          </Button>
        </div>
        {message && <p role="status">{message}</p>}
      </div>
      <div className="drawer-footer">
        <Button variant="light" onClick={onClose}>
          Close
        </Button>
        <span className="team-preview-label">Live delivery needs the backend</span>
      </div>
    </Drawer>
  );
}
