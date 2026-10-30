import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { ListingView } from '../finance/ListingView.jsx';
import { toProperty } from '../listingShares/listingShareLinks.js';
import { MarketplaceMatchChecklist } from './MarketplaceMatchChecklist.jsx';

/** The sender reviews a frozen snapshot before repeating its digest at submission. */
export function MarketplaceOfferSend({ requestId, matches, onSent, onBusy }) {
  const { api, user } = useSession();
  const { entries } = useRecords();
  const { t } = useI18n();
  const k = (key) => t(`marketplaceAnswers.${key}`);
  const [recordId, setRecordId] = useState('');
  const [review, setReview] = useState(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    onBusy?.(busy);
    return () => onBusy?.(false);
  }, [busy, onBusy]);
  const run = async (send) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (send) {
        await api.sendMarketplaceOffer(user.workspaceId, requestId, {
          recordId,
          previewDigest: review.previewDigest,
          checked,
        });
        setReview(null);
        setRecordId('');
        setChecked(false);
        onSent();
      } else {
        setReview(await api.previewMarketplaceOffer(user.workspaceId, requestId, recordId));
        setChecked(false);
      }
    } catch (failure) {
      setError(failure.message);
      if (send) setReview(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="market-offer-send">
      <h3>{k('matches')}</h3>
      {!matches.length ? (
        <p>{k('noMatches')}</p>
      ) : (
        <>
          <label className="field">
            <span>{k('chooseProperty')}</span>
            <select
              value={recordId}
              disabled={busy}
              onChange={(event) => {
                setRecordId(event.target.value);
                setReview(null);
                setChecked(false);
              }}
            >
              <option value="">{k('chooseProperty')}</option>
              {matches.map((match) => {
                const entry = entries?.Properties?.find((row) => row.id === match.recordId);
                return (
                  <option key={match.recordId} value={match.recordId}>
                    {entry?.record.listing_title || entry?.record.property_id || match.recordId}
                  </option>
                );
              })}
            </select>
          </label>
          {!review && (
            <Button onClick={() => run(false)} disabled={busy || !recordId}>
              {k('review')}
            </Button>
          )}
          {review && (
            <>
              <ListingView property={toProperty(review.before)} file={() => null} />
              <MarketplaceMatchChecklist
                checklist={matches.find((match) => match.recordId === recordId)?.checklist}
              />
              <p className="market-hint">{k('privacy')}</p>
              <label className="outside-share-check">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy}
                  onChange={(event) => setChecked(event.target.checked)}
                />
                <span>{k('consent')}</span>
              </label>
              <Button onClick={() => run(true)} disabled={busy || !checked}>
                {k('sendOffer')}
              </Button>
            </>
          )}
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
