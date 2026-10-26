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
import './marketplace-answers.css';

/** One request's offers and private conversations, including paused off-board requests. */
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
  const pending = busy || messageBusy || offerBusy;
  useUnsavedChanges(dirty, pending);
  const close = () => {
    if (!pending && (!dirty || window.confirm(k('discard')))) onClose();
  };
  const confirmDecision = (action, id) => {
    if (!pending && (!dirty || window.confirm(k('discard')))) setDecision({ action, id });
  };
  const detail = view.value;
  const request = detail?.request;
  const answers = detail?.answers || [];
  const matches = detail?.matches || [];
  const { active, open, canOffer, canMessage } = requestActivityCapabilities(detail);
  const changed = () => {
    setNotice(k('saved'));
    view.reload();
    onChanged?.();
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (decision.action === 'reject')
        await api.rejectMarketplaceOffer(user.workspaceId, requestId, decision.id);
      if (decision.action === 'select')
        await api.selectMarketplaceAnswer(
          user.workspaceId,
          requestId,
          decision.id,
          request.version,
        );
      if (decision.action === 'reopen')
        await api.reopenMarketplaceRequest(user.workspaceId, requestId, request.version);
      setDecision(null);
      changed();
    } catch (failure) {
      setError(failure.message);
      view.reload();
    } finally {
      setBusy(false);
    }
  };
  if (decision)
    return (
      <FinanceDialog
        title={k(`${decision.action}Title`)}
        intro={k(`${decision.action}Text`)}
        busy={busy}
        message={error}
        onClose={() => setDecision(null)}
        onSubmit={save}
        submitLabel={k('submit')}
      >
        <p className="market-hint">{k('privacy')}</p>
      </FinanceDialog>
    );
  return (
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
          <p className="market-hint">{k('privacy')}</p>
          {request.state === 'paused' && <p role="status">{k('paused')}</p>}
          <MarketplaceOffers
            answers={answers}
            isPoster={request.isPoster}
            open={open}
            busy={pending}
            onDecision={confirmDecision}
          />
          {canOffer && (
            <MarketplaceOfferSend
              requestId={requestId}
              matches={matches}
              onSent={changed}
              onBusy={setOfferBusy}
            />
          )}
          {request.isPoster && request.state === 'paused' && (
            <Button variant="light" onClick={() => confirmDecision('reopen')}>
              {k('reopen')}
            </Button>
          )}
          <MarketplaceConversations
            requestId={requestId}
            canMessage={canMessage}
            paused={['closed', 'expired'].includes(request.state)}
            onChanged={changed}
            onDirty={setDirty}
            onBusy={setMessageBusy}
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
  );
}
