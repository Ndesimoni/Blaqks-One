import React from 'react';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useSession } from '../../../../hooks/useSession.js';
import { useNavigation } from '../../../../hooks/useWorkspace.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { canOpenSection } from '../../access.js';
import { badge } from '../../chat/chatModel.js';
import { useChatCounts } from '../../chat/useChatCounts.js';
import { useInboxSummary } from '../../inbox/useInboxSummary.js';

const INBOX_POLL_MS = 30_000;

function InboxButton({ onOpen }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const { unread } = useInboxSummary(api, user.workspaceId, INBOX_POLL_MS);
  return (
    <button
      type="button"
      className="icon-btn header-message"
      aria-label={unread ? t('messenger.inboxUnread', { count: unread }) : t('messenger.inbox')}
      onClick={() => onOpen('inbox')}
    >
      <Icon name="chat" size={20} />
      {unread > 0 && <span className="header-badge">{badge(unread)}</span>}
    </button>
  );
}

function TeamButton({ onOpen }) {
  const { api, user } = useSession();
  const { route } = useNavigation();
  const { t } = useI18n();
  const { unread, mentions } = useChatCounts(api, user.workspaceId, route);
  return (
    <button
      type="button"
      className="icon-btn header-message"
      aria-label={unread ? t('messenger.teamUnread', { count: unread }) : t('messenger.team')}
      onClick={() => onOpen('team')}
    >
      <Icon name="users" size={20} />
      {(unread > 0 || mentions > 0) && (
        <span className="header-badge">{mentions ? `@${badge(mentions)}` : badge(unread)}</span>
      )}
    </button>
  );
}

/**
 * The header's messenger buttons (NAV3): Client inbox and Team chat with their unread
 * counts. Each opens the slide-in messenger on that box; people who may open neither (the
 * Super Admin reads no company conversations) see no buttons.
 */
export function HeaderMessages({ onOpen }) {
  const { user } = useSession();
  return (
    <>
      {canOpenSection(user, 'Inbox') && <InboxButton onOpen={onOpen} />}
      {canOpenSection(user, 'Team chat') && <TeamButton onOpen={onOpen} />}
    </>
  );
}
