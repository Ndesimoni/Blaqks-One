import React, { useState } from 'react';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

export function TeamInvitationLink({ invitation, onClose }) {
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  useUnsavedChanges(!copied);
  const link = `${location.origin}${location.pathname}#/activate-invitation?token=${encodeURIComponent(invitation.token)}`;
  const close = () => {
    if (
      copied ||
      confirm('Have you saved this private invitation link? It cannot be retrieved after closing.')
    )
      onClose();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setNotice('Invitation link copied.');
    } catch {
      setNotice('Select the link below and copy it manually.');
    }
  };
  return (
    <Drawer titleId="invitation-link-title" onClose={close}>
      <div className="drawer-top">
        <h2 id="invitation-link-title">Invitation ready</h2>
        <Button variant="light" onClick={close}>
          Close
        </Button>
      </div>
      <div className="drawer-body">
        <p>Share this private link directly with {invitation.name}. No email has been sent.</p>
        <p>Expires {new Date(invitation.expiresAt).toLocaleString()}.</p>
        <div className="field">
          <label htmlFor="invitation-link">Activation link</label>
          <textarea
            id="invitation-link"
            readOnly
            value={link}
            rows={4}
            onFocus={(event) => event.target.select()}
          />
        </div>
        <p>Keep the link private. The recipient chooses their own password.</p>
        {notice && <p role="status">{notice}</p>}
      </div>
      <div className="drawer-footer">
        <Button variant="light" onClick={close}>
          Done
        </Button>
        <Button onClick={copy}>Copy invitation link</Button>
      </div>
    </Drawer>
  );
}
