import { BrandMark } from './BrandMark.jsx';
import { nav } from '../../config/navigation.js';
import { Icon } from '../ui/Icon.jsx';
import React, { useRef } from 'react';
import { useNavigation, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { Drawer } from '../ui/Drawer.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useTeam } from '../../hooks/useTeam.js';
import { canVisit } from '../../features/team/model.js';
import { useNavigationScroll } from '../../hooks/useNavigationScroll.js';

function Sidebar() {
  const { user } = useSession();
  const { team } = useTeam();
  const { route, navigate } = useNavigation();
  const { mobileNav, setMobileNav } = useWorkspaceView();
  const isMobile = useMediaQuery('(max-width: 1050px)');
  const sidebarRef = useRef(null);
  useNavigationScroll(sidebarRef, route, mobileNav);
  const content = (
    <aside
      ref={sidebarRef}
      id="workspace-sidebar"
      className={'sidebar ' + (mobileNav ? 'sidebar-open' : '')}
    >
      {isMobile && (
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
        {nav
          .filter((group) => group.items.some(([name]) => canVisit(user, name)))
          .map((g) => (
            <div key={g.header} className="nav-group">
              <div className="nav-label">{g.header}</div>
              {g.items
                .filter(([name]) => canVisit(user, name))
                .map(([name, ico]) => (
                  <button
                    key={name}
                    className={'nav-item ' + (route === name ? 'active' : '')}
                    aria-current={route === name ? 'page' : undefined}
                    onClick={() => {
                      navigate(name);
                      setMobileNav(false);
                    }}
                  >
                    <Icon name={ico} size={18} />
                    <span>{name}</span>
                    {route === name && <span className="nav-active-dot" />}
                  </button>
                ))}
            </div>
          ))}
      </nav>
      <div className="sidebar-bottom">
        <nav className="team-settings-nav" aria-label="Workspace settings">
          <span className="nav-label">SETTINGS</span>
          {[
            'My profile',
            'Team activity',
            ...(user.managesTeam ? ['Workspaces'] : []),
            ...(!team.configured || user.managesTeam ? ['Team & access'] : []),
          ].map((name) => (
            <button
              type="button"
              key={name}
              className={'settings-item' + (route === name ? ' active' : '')}
              aria-current={route === name ? 'page' : undefined}
              onClick={() => {
                navigate(name);
                setMobileNav(false);
              }}
            >
              <Icon
                name={
                  name === 'My profile'
                    ? 'person'
                    : name === 'Workspaces'
                      ? 'building'
                      : name === 'Team activity'
                        ? 'clock'
                        : 'shield'
                }
                size={18}
              />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="side-footer">
          <span className="footer-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>
              {user.role} · {user.managesTeam ? 'All workspaces' : 'Own workspace'} ·{' '}
              {Object.values(user.permissions).every(Boolean) ? 'Full access' : 'Assigned access'}
            </small>
          </div>
          <Icon name="shield" size={17} />
        </div>
      </div>
    </aside>
  );
  if (!isMobile) return content;
  return mobileNav ? (
    <Drawer
      className="navigation-drawer"
      placement="side"
      titleId="navigation-title"
      onClose={() => setMobileNav(false)}
    >
      <h2 className="sr-only" id="navigation-title">
        CRM navigation
      </h2>
      {content}
    </Drawer>
  ) : null;
}

export { Sidebar };
