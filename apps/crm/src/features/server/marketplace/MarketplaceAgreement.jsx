import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { useSession } from '../../../hooks/useSession.js';
import { ListingView } from '../finance/ListingView.jsx';
import { toProperty } from '../listingShares/listingShareLinks.js';

/** Server release decisions are authoritative; a selected offer alone reveals no contacts. */
export function MarketplaceAgreement({ answer, request, busy, onOpen }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const k = (key) => t(`marketplaceAgreement.${key}`);
  const release = answer.release;
  return (
    <section className="market-agreement" aria-label={k('title')}>
      <h4>{k('title')}</h4>
      {answer.agreement && (
        <>
          <p>{k('agreementReady')}</p>
          <Button
            variant="light"
            disabled={busy}
            onClick={() => onOpen({ id: answer.agreement.id })}
          >
            {k('open')}
          </Button>
        </>
      )}
      {answer.state === 'chosen' && request.canProposeAgreement && request.agreementDraft && (
        <Button
          disabled={busy}
          onClick={() =>
            onOpen({
              form: {
                mode: 'share',
                detail: {
                  ...request.agreementDraft,
                  marketplaceRequestId: request.id,
                },
              },
            })
          }
        >
          {k('propose')}
        </Button>
      )}
      {release?.released === true && release.listing ? (
        <>
          <p role="status">{k('released')}</p>
          <ListingView
            property={toProperty(release.listing, release.photos || [], release.floorPlans || [])}
            file={(file) => api.listingShareFileUrl(user.workspaceId, answer.shareId, file)}
          />
          <dl className="record-review-grid">
            {['requester', 'broker'].map((side) => {
              const person = release.contacts?.[side];
              const digits = person?.phone?.replace(/\D/g, '') || '';
              const other = side === (request.isPoster ? 'broker' : 'requester');
              return (
                person && (
                  <div key={side}>
                    <dt>{k(side)}</dt>
                    <dd>{person.name}</dd>
                    <dd>
                      {person.phone ? (
                        <a href={`tel:${person.phone}`}>{person.phone}</a>
                      ) : (
                        k('noPhone')
                      )}
                    </dd>
                    {other && /^\d{7,15}$/.test(digits) && (
                      <dd>
                        <a
                          href={`https://wa.me/${digits}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {k('whatsapp')}
                        </a>
                      </dd>
                    )}
                  </div>
                )
              );
            })}
          </dl>
        </>
      ) : (
        <p className="market-hint">{k('sealed')}</p>
      )}
    </section>
  );
}
