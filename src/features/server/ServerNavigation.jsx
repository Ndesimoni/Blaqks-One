import React, { useRef } from 'react';
import { BrandMark } from '../../components/layout/BrandMark.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useSession } from '../../hooks/useSession.js';
import { useNavigation, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { useNavigationScroll } from '../../hooks/useNavigationScroll.js';
import { ServerNavigationGroups } from './ServerNavigationGroups.jsx';
import { ServerNavigationSettings } from './ServerNavigationSettings.jsx';
import './navigation.css';

export function ServerNavigation() {
  const { user } = useSession();
  const { route, navigate } = useNavigation();
  const { mobileNav, setMobileNav } = useWorkspaceView();
  const mobile = useMediaQuery('(max-width: 1050px)');
  const sidebarRef = useRef(null);
  useNavigationScroll(sidebarRef, route, !mobile || mobileNav);
  const select = (name) => {
    navigate(name);
    setMobileNav(false);
  };
  const content = (
    <aside
      ref={sidebarRef}
      id="workspace-sidebar"
      className={'sidebar' + (mobileNav ? ' sidebar-open' : '')}
    >
      {mobile && (
        <button
          className="navigation-close"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        >
          <Icon name="close" size={20} />
        </button>
      )}
      <div className="brand">
        <BrandMark />
        <div>
          <strong>
            KEYS <i>WITH</i> SIMONI
          </strong>
          <span>REAL ESTATE STUDIO</span>
        </div>
      </div>
      <div className="sidebar-hairline" />
      <nav className="nav-groups" aria-label="CRM sections">
        <ServerNavigationGroups user={user} route={route} onSelect={select} />
        <ServerNavigationSettings user={user} route={route} onSelect={select} />
        <p className="connected-nav-legend">
          Not connected sections show their current availability. They do not use demo records.
        </p>
      </nav>
      <div className="sidebar-bottom">
        <div className="side-footer">
          <span className="footer-avatar">{user.name.slice(0, 1)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </div>
          <Icon name="shield" size={17} />
        </div>
      </div>
    </aside>
  );
  if (!mobile) return content;
  if (!mobileNav) return null;
  return (
    <Drawer
      className="navigation-drawer"
      placement="side"
      titleId="connected-navigation-title"
      onClose={() => setMobileNav(false)}
    >
      <h2 id="connected-navigation-title" className="sr-only">
        CRM navigation
      </h2>
      {content}
    </Drawer>
  );
}
