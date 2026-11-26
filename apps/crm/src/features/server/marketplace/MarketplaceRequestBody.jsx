import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { requestActivityCapabilities } from './marketActivityModel.js';
import { MarketplaceConversations } from './MarketplaceConversations.jsx';
import { MarketplaceOffers } from './MarketplaceOffers.jsx';
import { MarketplaceOfferSend } from './MarketplaceOfferSend.jsx';
import { MarketplaceReopen } from './MarketplaceReopen.jsx';
import { MarketplaceRequestFacts } from './MarketplaceRequestFacts.jsx';

/** "What the client is looking for": the request's shared facts, when the opener has them. */
function RequestNeeds({ summary }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section className="market-section" aria-labelledby={id}>
      <h3 id={id}>{t('marketplaceAnswers.needs')}</h3>
      <MarketplaceRequestFacts request={summary} />
    </section>
  );
}

/**
 * The request slider's body (marketplace redesign): the round's status and privacy, the offer
 * slots, what the client is looking for, the sender's own offer form, then the private broker
 * conversations. The server's capabilities decide every action; nothing here infers them.
 */
export function MarketplaceRequestBody({
  requestId,
  detail,
  summary,
  busy,
  refreshing,
  onDecision,
  onAgreement,
  onOpenBroker,
  onChanged,
  onOfferBusy,
  onMessageBusy,
  onDirty,
  onRefresh,
}) {
  const { t } = useI18n();
  const k = (key, vars) => t(`marketplaceAnswers.${key}`, vars);
  const { request, answers = [], matches = [] } = detail;
  const { active, open, canOffer, canMessage } = requestActivityCapabilities(detail);
  const released = answers.some((answer) => answer.release?.released === true);
  return (
    <div className="market-request-activity">
      <div className="market-request-status">
        <div className="market-status-pills">
          <p className="market-capacity">{k('capacity', { count: active })}</p>
          {request.state === 'paused' && (
            <p className="market-paused" role="status">
              {k('paused')}
            </p>
          )}
        </div>
        <p className="market-private-line">
          <Icon name="lock" size={15} />
          <span>{released ? t('marketplaceAgreement.releasedPrivacy') : k('privacy')}</span>
        </p>
        <MarketplaceReopen request={request} busy={busy} onReopen={() => onDecision('reopen')} />
      </div>
      <MarketplaceOffers
        answers={answers}
        request={request}
        isPoster={request.isPoster}
        open={open}
        active={active}
        busy={busy}
        onDecision={onDecision}
        onAgreement={onAgreement}
        onOpenBroker={onOpenBroker}
      />
      {summary && <RequestNeeds summary={summary} />}
      {canOffer && (
        <MarketplaceOfferSend
          requestId={requestId}
          matches={matches}
          onSent={onChanged}
          onBusy={onOfferBusy}
        />
      )}
      <MarketplaceConversations
        requestId={requestId}
        canMessage={canMessage}
        paused={['closed', 'expired'].includes(request.state)}
        onChanged={onChanged}
        onDirty={onDirty}
        onBusy={onMessageBusy}
        onOpenBroker={onOpenBroker}
      />
      <div className="market-actions">
        <Button variant="light" onClick={onRefresh} disabled={refreshing || busy}>
          {k('refresh')}
        </Button>
      </div>
    </div>
  );
}
