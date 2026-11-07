import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { requestTitle } from '../marketplace/requestText.js';

/**
 * The mockup's request pane beside a broker chat (wide screens): whose request it is, what the
 * client is looking for, the budget band and when it ends, and the way to the request, where
 * offers, co-broking and Not a match live. The client is never named.
 */
export function MarketChatSide({ chat }) {
  const { t, format } = useI18n();
  const { navigate } = useNavigation();
  const k = (key, vars) => t(`marketChats.${key}`, vars);
  const request = chat.request;
  const areas = (request.communities || []).join(', ');
  const facts = [
    [k('lookingFor'), requestTitle(t, request)],
    [k('areas'), areas],
    [k('budget'), t(`marketplaceRequests.band.${request.budgetBand}`)],
    [k('ends'), format.date(request.expiresAt)],
  ].filter(([, value]) => value);
  return (
    <aside className="chat-members-pane market-chat-side" aria-label={k('requestPane')}>
      <h2>{k(chat.mine ? 'yourRequestTitle' : 'theirRequestTitle')}</h2>
      <dl>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="chat-muted">{k('offersThere')}</p>
      <Button variant="light" onClick={() => navigate(chat.mine ? 'My requests' : 'Marketplace')}>
        {k(chat.mine ? 'openMine' : 'openBoard')}
      </Button>
    </aside>
  );
}
