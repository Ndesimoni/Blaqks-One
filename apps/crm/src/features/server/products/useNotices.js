import { useSession } from '../../../hooks/useSession.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { canOpenSection } from '../access.js';
import { useChatCounts } from '../chat/useChatCounts.js';
import { useWaitingCount } from '../useWaitingCount.js';
import { waitingSources } from '../waitingCounts.js';
import { noticeRows } from './noticesModel.js';
import { hasPlatformArea, isPlatformMember } from '../platformAccess.js';

const BELL_POLL_MS = 60_000;

/**
 * The bell's rows from the sources the sidebar badges and the Team chat button already read,
 * refreshed on page changes, change events and every minute. The Super Admin, who reads no
 * company conversations and decides no hand-overs, sees marketplace applications only.
 */
export function useNotices() {
  const { api, user } = useSession();
  const { route } = useNavigation();
  // The Blaqks One team reads no company conversations or hand-overs (BO1a, BO1b).
  const platform = isPlatformMember(user);
  const member = Boolean(user) && !platform;
  const reviews = hasPlatformArea(user, 'marketplace');
  const counts = {
    // Mentions come from the person's own team chat: their company's, or Blaqks One's (BO1f).
    mentions: useChatCounts(api, user?.workspaceId, route, Boolean(user)).mentions,
    handovers: useWaitingCount(waitingSources.Deals, member, route, BELL_POLL_MS),
    agreements: useWaitingCount(waitingSources.Agreements, member, route, BELL_POLL_MS),
    applications: useWaitingCount(waitingSources.Applications, reviews, route, BELL_POLL_MS),
    clients: useWaitingCount(waitingSources.Clients, member, route, BELL_POLL_MS),
    properties: useWaitingCount(waitingSources.Properties, member, route, BELL_POLL_MS),
    contacts: useWaitingCount(waitingSources.Contacts, member, route, BELL_POLL_MS),
  };
  return noticeRows(counts, (name) => canOpenSection(user, name));
}
