import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { MarketplaceOffers } from './MarketplaceOffers.jsx';
import { MarketplaceOfferSend } from './MarketplaceOfferSend.jsx';
import { MarketplaceConversations } from './MarketplaceConversations.jsx';
import { useMarketActivity } from './useMarketActivity.js';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { requestActivityCapabilities } from './marketActivityModel.js';
import { MarketplaceDecisionDialog } from './MarketplaceDecisionDialog.jsx';
import { ShareCoBroking } from '../listingShares/ShareCoBroking.jsx';
import { applyMarketplaceDecision } from './marketplaceDecision.js';
import { MarketplaceReopen } from './MarketplaceReopen.jsx';
import { MarketplaceProfileDialog } from './MarketplaceProfileDialog.jsx';
import './marketplace-answers.css';
export function MarketplaceRequestActivity({ requestId, onClose, onChanged }) {
  const { api, user } = useSession();
  const { t } = useI18n();
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
  const close = () => {
    if (!pending && (!dirty || window.confirm(k('discard')))) onClose();
  };
  const confirmDecision = (action, id) => {
    if (!pending && (!dirty || window.confirm(k('discard')))) setDecision({ action, id });
  };
  const { request, answers = [], matches = [] } = view.value || {};
  const { active, open, canOffer, canMessage } = requestActivityCapabilities(view.value);
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
  return (
    <>
      <FinanceDialog title={k('title')} onClose={close} busy={pending} wide>
        {view.loading && <p role="status">{k('loading')}</p>}
        {view.error && (
          <p className="field-error" role="alert">
            {view.error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {request && (
          <div className="market-request-activity">
            <p>{k('capacity', { count: active })}</p>
            <p className="market-hint">
              {answers.some((answer) => answer.release?.released === true)
                ? t('marketplaceAgreement.releasedPrivacy')
                : k('privacy')}
            </p>
            {request.state === 'paused' && <p role="status">{k('paused')}</p>}
            <MarketplaceOffers
              answers={answers}
              request={request}
              isPoster={request.isPoster}
              open={open}
              busy={pending}
              onDecision={confirmDecision}
              onAgreement={(value) => {
                if (!pending && (!dirty || window.confirm(k('discard')))) setAgreement(value);
              }}
              onOpenBroker={setBroker}
            />
            {canOffer && (
              <MarketplaceOfferSend
                requestId={requestId}
                matches={matches}
                onSent={changed}
                onBusy={setOfferBusy}
              />
            )}
            <MarketplaceReopen
              request={request}
              busy={pending}
              onReopen={() => confirmDecision('reopen')}
            />
            <MarketplaceConversations
              requestId={requestId}
              canMessage={canMessage}
              paused={['closed', 'expired'].includes(request.state)}
              onChanged={changed}
              onDirty={setDirty}
              onBusy={setMessageBusy}
              onOpenBroker={setBroker}
            />
            <Button
              variant="light"
              onClick={() => {
                if (!dirty || window.confirm(k('discard'))) view.reload();
              }}
              disabled={view.loading || pending}
            >
              {k('refresh')}
            </Button>
          </div>
        )}
      </FinanceDialog>
      {broker && <MarketplaceProfileDialog memberId={broker} onClose={() => setBroker('')} />}
    </>
  );
}
