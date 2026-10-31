import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { AccountMenu } from './products/AccountMenu.jsx';
import { ServerTheme } from './ServerTheme.jsx';
import { useWorkspaceView, useWorkspaceActions } from '../../hooks/useWorkspace.js';

/** The top bar names the member's company, so no workspace panel is needed on each page. */
export function ServerHeader({ owner, sidebarOpen, onToggleSidebar }) {
  const { t } = useI18n();
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
        {onToggleSidebar && (
          <button
            type="button"
            className="icon-btn sidebar-toggle"
            aria-controls="section-sidebar"
            aria-expanded={sidebarOpen}
            aria-label={t(sidebarOpen ? 'products.hideSections' : 'products.showSections')}
            onClick={onToggleSidebar}
          >
            <Icon name="menu" size={20} />
          </button>
        )}
        <strong className="topbar-workspace">{owner?.name || 'Connected CRM'}</strong>
      </div>
      <div className="top-actions">
        <ServerTheme />
        <AccountMenu busy={busy} />
      </div>
    </header>
  );
}
