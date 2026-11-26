import React, { useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { ShareCoBroking } from '../listingShares/ShareCoBroking.jsx';
import { MarketplaceDecisionDialog } from './MarketplaceDecisionDialog.jsx';
import { MarketplaceProfileDialog } from './MarketplaceProfileDialog.jsx';
import { MarketplaceRequestBody } from './MarketplaceRequestBody.jsx';
import { applyMarketplaceDecision } from './marketplaceDecision.js';
import { requestTitle } from './requestText.js';
import { useMarketActivity } from './useMarketActivity.js';
import './marketplace-answers.css';
import './marketplace-offers.css';

/**
 * One request's offers and private broker messages in a right-hand slider (marketplace
 * redesign). `summary` is the request as the opener already shows it, for the slider's title
 * and "What the client is looking for"; without it the generic title is shown. Unsent text
 * and busy work guard every way out, as before.
 */
export function MarketplaceRequestActivity({ requestId, summary, onClose, onChanged }) {
  const { api, user } = useSession();
  const { t, format } = useI18n();
  const k = (key, vars) => t(`marketplaceAnswers.${key}`, vars);
  const view = useMarketActivity('marketplaceOffers', requestId);
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);
  const [agreement, setAgreement] = useState(null);
  const [broker, setBroker] = useState('');
  const pending = busy || messageBusy || offerBusy;
  useUnsavedChanges(dirty, pending);
  const guarded = (then) => {
    if (!pending && (!dirty || window.confirm(k('discard')))) then();
  };
  const request = view.value?.request;
  const changed = () => {
    setNotice(k('saved'));
    view.reload();
    onChanged?.();
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await applyMarketplaceDecision(api, user.workspaceId, request, decision);
      setDecision(null);
      changed();
    } catch (failure) {
      setError(failure.message);
      view.reload();
    } finally {
      setBusy(false);
    }
  };
  if (agreement)
    return (
      <ShareCoBroking
        view={agreement}
        onView={setAgreement}
        onClose={() => {
          setAgreement(null);
          changed();
        }}
      />
    );
  if (decision)
    return (
      <MarketplaceDecisionDialog
        decision={decision}
        busy={busy}
        error={error}
        onClose={() => setDecision(null)}
        onSubmit={save}
      />
    );
  const day = (value) => format.date(value) || value;
  return (
    <>
      <FinanceDialog
        eyebrow={summary ? t('marketplaceBoard.detail.eyebrow') : ''}
        title={summary ? requestTitle(t, summary) : k('title')}
        intro={
          summary
            ? t('marketplaceRequests.board.posted', {
                posted: day(summary.createdAt),
                ends: day(summary.expiresAt),
              })
            : ''
        }
        onClose={() => guarded(onClose)}
        busy={pending}
        wide
        className="market-slider"
      >
        {view.loading && <p role="status">{k('loading')}</p>}
        {view.error && (
          <p className="field-error" role="alert">
            {view.error}
          </p>
        )}
        {notice && (
          <p className="market-notice" role="status">
            {notice}
          </p>
        )}
        {request && (
          <MarketplaceRequestBody
            requestId={requestId}
            detail={view.value}
            summary={summary}
            busy={pending}
            refreshing={view.loading}
            onDecision={(action, id) => guarded(() => setDecision({ action, id }))}
            onAgreement={(value) => guarded(() => setAgreement(value))}
            onOpenBroker={setBroker}
            onChanged={changed}
            onOfferBusy={setOfferBusy}
            onMessageBusy={setMessageBusy}
            onDirty={setDirty}
            onRefresh={() => {
              if (!dirty || window.confirm(k('discard'))) view.reload();
            }}
          />
        )}
      </FinanceDialog>
      {broker && <MarketplaceProfileDialog memberId={broker} onClose={() => setBroker('')} />}
    </>
  );
}
