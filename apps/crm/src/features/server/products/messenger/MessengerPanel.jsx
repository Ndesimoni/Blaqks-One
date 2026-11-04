import React, { useState } from 'react';
import { Drawer } from '../../../../components/ui/Drawer.jsx';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useSession } from '../../../../hooks/useSession.js';
import { useLocation, useNavigate } from 'react-router-dom';
import { routePath } from '../../../../config/routes.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { canOpenSection } from '../../access.js';
import { ServerTeamChat } from '../../chat/ServerTeamChat.jsx';
import { ServerInbox } from '../../inbox/ServerInbox.jsx';
import './messenger.css';

// The approved mockup names the boxes Client inbox and Team chat.
const boxes = [
  ['inbox', 'Inbox', 'messenger.inboxBox'],
  ['team', 'Team chat', 'messenger.teamBox'],
];

/**
 * The slide-in messenger (NAV3, Bitrix24's pattern): Client inbox and Team chat from the
 * right edge over any page, one pane at a time like the phone layout. The open conversation
 * lives in the panel, not the address bar, so the page behind keeps its own address.
 */
export function MessengerPanel({ owner, box, start = '', onBox, onClose }) {
  const { t } = useI18n();
  const { user } = useSession();
  const go = useNavigate();
  const { search } = useLocation();
  // `start` opens one conversation straight away, as a chat strip avatar asks.
  const [open, setOpen] = useState(() => ({ inbox: '', team: '', ...(start && { [box]: start }) }));
  const allowed = boxes.filter(([, route]) => canOpenSection(user, route));
  const selection = {
    id: open[box],
    open: (id) => setOpen((current) => ({ ...current, [box]: id })),
  };
  // The full page opens on the conversation that was open here (the address names it).
  const fullPage = () => {
    onClose();
    const params = new URLSearchParams();
    const workspace = new URLSearchParams(search).get('workspace');
    if (workspace) params.set('workspace', workspace);
    if (open[box]) params.set(box === 'team' ? 'room' : 'conversation', open[box]);
    const path = routePath(box === 'team' ? 'Team chat' : 'Inbox');
    go(path + (params.size ? `?${params}` : ''));
  };
  return (
    <Drawer
      className="messenger-drawer"
      placement="side"
      titleId="messenger-title"
      onClose={onClose}
    >
      <div className="messenger-panel">
        <header className="messenger-head">
          <h2 id="messenger-title">
            {t(allowed.find(([key]) => key === box)?.[2] || 'messenger.inboxBox')}
          </h2>
          <button type="button" className="messenger-full" onClick={fullPage}>
            {t('messenger.fullPage')}
          </button>
          <button
            type="button"
            className="icon-btn messenger-close"
            aria-label={t('messenger.close')}
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
          {allowed.length > 1 && (
            <div className="messenger-switch" role="group" aria-label={t('messenger.switch')}>
              {allowed.map(([key, , label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={key === box}
                  onClick={() => onBox(key)}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          )}
        </header>
        <div className="messenger-body">
          {box === 'team' ? (
            <ServerTeamChat selection={selection} />
          ) : (
            <ServerInbox owner={owner} selection={selection} />
          )}
        </div>
      </div>
    </Drawer>
  );
}
