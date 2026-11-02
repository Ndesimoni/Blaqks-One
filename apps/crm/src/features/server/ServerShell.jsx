import React, { useState } from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useSession } from '../../hooks/useSession.js';
import { useNavigation, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { useI18n } from '../../i18n/useI18n.js';
import { canOpenSection } from './access.js';
import { ServerContent } from './ServerContent.jsx';
import { ServerDialogs } from './ServerDialogs.jsx';
import { ServerHeader } from './ServerHeader.jsx';
import { ServerNavigation } from './ServerNavigation.jsx';
import { ServerPageActions } from './ServerPageActions.jsx';
import { ServerWorkspaceBanner } from './ServerWorkspaceBanner.jsx';
import { SectionTabs } from './products/SectionTabs.jsx';
import { useProductNav } from './products/useProductNav.js';
import { ChatStrip } from './products/messenger/ChatStrip.jsx';
import { MessengerContext } from './products/messenger/messengerContext.js';
import { MessengerPanel } from './products/messenger/MessengerPanel.jsx';
import { BottomBar } from './products/BottomBar.jsx';
import { visibleProducts } from './products/productModel.js';

export function ServerShell({ owner, workspaces }) {
  const { user } = useSession();
  const { t } = useI18n();
  const { route, navigate } = useNavigation();
  const nav = useProductNav(user, route, navigate);
  const [messenger, setMessenger] = useState(null);
  const [start, setStart] = useState('');
  const platform = route === 'Platform website';
  // Inbox and Team chat fill the window like messenger apps: no page heading or footer.
  const fullHeight = ['Inbox', 'Team chat'].includes(route);
  // Bitrix24's right panel (NAV5) on wide screens, the messenger pages included as in the
  // approved mockup; the Super Admin reads no company conversations.
  const wide = useMediaQuery('(min-width: 1181px)');
  const strip =
    wide &&
    user.roleId !== 'super-admin' &&
    (canOpenSection(user, 'Inbox') || canOpenSection(user, 'Team chat'));
  const { toast, setToast, setMobileNav } = useWorkspaceView();
  const openMessenger = (box, id = '') => {
    setStart(id);
    setMessenger(box);
  };
  // Pages and record sliders open a client's conversation in the messenger (Message).
  return (
    <MessengerContext.Provider value={openMessenger}>
      <div
        className={
          'app-shell connected-shell has-rail has-bottom-bar' +
          (nav.sectionsVisible ? '' : ' sections-hidden') +
          (strip ? ' has-chat-strip' : '')
        }
      >
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById('main-content')?.focus();
          }}
        >
          Skip to main content
        </a>
        <ServerNavigation
          nav={nav}
          company={platform ? t('websites.platformTitle') : owner?.name}
        />
        <div className={'main-area' + (fullHeight ? ' is-full-height' : '')}>
          <ServerHeader
            product={nav.here?.product}
            section={nav.here?.section?.key}
            sidebarOpen={nav.sectionsVisible}
            onToggleSidebar={nav.here ? nav.toggleSidebar : null}
            onMessenger={openMessenger}
          />
          <SectionTabs user={user} section={nav.here?.section} route={route} navigate={navigate} />
          <main className="main-content" id="main-content" tabIndex={-1}>
            <ServerWorkspaceBanner owner={owner} workspaces={workspaces} platform={platform} />
            {!fullHeight && route !== 'Start' && (
              <ServerPageActions owner={owner} workspaces={workspaces} />
            )}
            <ServerContent owner={owner} />
            {!fullHeight && (
              <footer className="main-footer">
                <span>© {new Date().getFullYear()} Keys with Simoni</span>
              </footer>
            )}
          </main>
        </div>
        {strip && <ChatStrip refreshKey={`${route}|${messenger}`} onOpen={openMessenger} />}
        <BottomBar
          products={visibleProducts(user)}
          current={nav.here?.product || null}
          route={route}
          onOpen={nav.openProduct}
          onHome={() => navigate('Start')}
          onSections={() => setMobileNav(true)}
        />
        <ServerDialogs />
        {messenger && (
          <MessengerPanel
            owner={owner}
            box={messenger}
            start={start}
            onBox={setMessenger}
            onClose={() => setMessenger(null)}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            <Icon name="info" size={17} />
            {toast}
            <button aria-label="Dismiss notification" onClick={() => setToast('')}>
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
      </div>
    </MessengerContext.Provider>
  );
}
