import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useI18n } from '../../i18n/useI18n.js';
import { AccountMenu } from './products/AccountMenu.jsx';
import { CreateMenu } from './products/CreateMenu.jsx';
import { HeaderTitle } from './products/HeaderTitle.jsx';
import { HeaderMessages } from './products/messenger/HeaderMessages.jsx';
import { HeaderSearch } from './products/HeaderSearch.jsx';
import { NotificationBell } from './products/NotificationBell.jsx';
import { ServerTheme } from './ServerTheme.jsx';
import { useNavigation, useWorkspaceView, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import './products/frame.css';

/**
 * The top bar (NAV5, Bitrix24's header): the product and page name, search, Create for the
 * current product, the messenger, notifications, the theme and the account menu. The company is named in the section
 * sidebar, so no workspace panel is needed on each page.
 */
export function ServerHeader({ product, sidebarOpen, onToggleSidebar, onMessenger }) {
  const { t } = useI18n();
  const { user } = useSession();
  const { route } = useNavigation();
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
        <HeaderTitle user={user} route={route} product={product} />
      </div>
      <div className="top-actions">
        <HeaderSearch />
        <CreateMenu product={product} />
        <HeaderMessages onOpen={onMessenger} />
        <NotificationBell />
        <ServerTheme />
        <AccountMenu busy={busy} />
      </div>
    </header>
  );
}
