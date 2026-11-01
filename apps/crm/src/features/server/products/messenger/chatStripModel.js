import { roomTitle } from '../../chat/chatModel.js';
import { contactTitle, initials as senderInitials } from '../../inbox/inboxModel.js';
import { initials } from '../../profile/profileModel.js';

/** How many conversations of each box the strip shows. */
export const STRIP_SHOWN = 3;

const newest = (a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '');

/**
 * The strip's conversations (NAV5, Bitrix24's right panel): the person's newest Client inbox
 * conversations in the list's own order, then their most recent Team chat rooms. An inbox
 * conversation is unread or not; a room carries its unread count.
 */
export function stripItems(rows = [], rooms = [], people = [], t) {
  const inbox = rows.slice(0, STRIP_SHOWN).map((row) => ({
    box: 'inbox',
    id: row.id,
    name: contactTitle(row) || t('messenger.unknownSender'),
    initials: senderInitials(row),
    unread: row.unread ? 1 : 0,
  }));
  const team = [...rooms]
    .sort(newest)
    .slice(0, STRIP_SHOWN)
    .map((room) => {
      const name = roomTitle(room, people, t);
      return {
        box: 'team',
        id: room.id,
        name,
        initials: initials(name.replace(/^#/, '')),
        unread: Number(room.unread) || 0,
      };
    });
  return [...inbox, ...team];
}

/** The button's name: who, which box, and what is unread. */
export function stripLabel(item, t) {
  if (item.box === 'inbox')
    return t(item.unread ? 'messenger.stripInboxUnread' : 'messenger.stripInbox', {
      name: item.name,
    });
  return item.unread
    ? t('messenger.stripTeamUnread', { name: item.name, count: item.unread })
    : t('messenger.stripTeam', { name: item.name });
}
