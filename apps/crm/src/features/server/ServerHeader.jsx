import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ServerTheme } from './ServerTheme.jsx';
import { useWorkspaceView, useWorkspaceActions } from '../../hooks/useWorkspace.js';

/** The top bar names the member's company, so no workspace panel is needed on each page. */
export function ServerHeader({ owner }) {
  const go = useNavigate();
  const { mobileNav, setMobileNav } = useWorkspaceView();
  const { busy } = useWorkspaceActions();
  return (
    <header className="topbar">
      <div className="top-left">
        <button
          className="hamburger"
          aria-label="Toggle navigation"
          aria-expanded={mobileNav}
          aria-controls="workspace-sidebar"
          onClick={() => setMobileNav(!mobileNav)}
        >
          <Icon name="menu" size={22} />
        </button>
        <strong className="topbar-workspace">{owner?.name || 'Connected CRM'}</strong>
      </div>
      <div className="top-actions">
        <ServerTheme />
        <Button variant="light" disabled={busy} onClick={() => go('/sign-out')}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
