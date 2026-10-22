import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { Facts } from '../agreements/AgreementTerms.jsx';
import { HandoverListing } from './HandoverListing.jsx';
import '../agreements/agreement-terms.css';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** What the receiver would earn, or why the server gives no figure (agreements design §17). */
function earning({ handover, deal }, k, money) {
  if (handover.toAdmin)
    return (
      <>
        {k('offer.adminEarns')}
        <small>{`\n${k('offer.adminNote')}`}</small>
      </>
    );
  if (deal.receiverEarnsFils !== null)
    return <span className="agreement-figure">{money(deal.receiverEarnsFils)}</span>;
  return k(deal.earned ? 'offer.earnedUnchanged' : 'offer.noSettings');
}

/**
 * The server-shaped review of an open hand-over (agreements design §17, owner decision 1):
 * the deal's money and dates, the offer and what the receiver would earn, the listing
 * (`HandoverListing`) and the client's first name and last initial. Client contact, notes and documents are never
 * sent before acceptance, so nothing here can show them. `viewerId` words the earning line.
 */
export function HandoverPreview({ preview, viewerId }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`handoverReview.${key}`, vars);
  const { handover, offer, deal, property, client } = preview;
  const known = (value, show = (v) => v) => (value === null ? k('notRecorded') : show(value));
  const day = (value) => known(value, (v) => (DAY.test(v) ? format.date(v) : v));
  const figure = (fils) => <span className="agreement-figure">{format.money(fils)}</span>;
  const partner = deal.partnerShareBp > 0 || Boolean(deal.partnerName);
  const names = { from: handover.from.name, to: handover.to.name };
  return (
    <div className="agreement-terms handover-preview">
      <Facts
        title={k('deal.title')}
        rows={[
          [k('deal.type'), deal.dealType],
          [
            k('deal.stage'),
            deal.earned ? k('deal.earnedStage', { stage: deal.stage }) : deal.stage,
          ],
          [k('deal.agreedValue'), format.money(deal.agreedValueFils)],
          [
            k('deal.feeBasis'),
            deal.feeBasis === 'fixed'
              ? k('deal.fixed', { amount: format.money(deal.fixedFeeFils) })
              : k('deal.percentage', { rate: format.percent(deal.feeRateBp) }),
          ],
          [k('deal.fee'), figure(deal.feeFils)],
          [
            k('deal.partner'),
            partner
              ? k('deal.partnerValue', {
                  name: deal.partnerName || k('notRecorded'),
                  share: format.percent(deal.partnerShareBp),
                  amount: format.money(deal.partnerFils),
                })
              : k('deal.noPartner'),
          ],
          [k('deal.net'), known(deal.netFils, format.money)],
          [k('deal.received'), format.money(deal.receivedFils)],
          [k('deal.opened'), day(deal.openedDate)],
          [k('deal.targetClose'), day(deal.targetCloseDate)],
          [k('deal.milestone'), known(deal.milestone)],
          [k('deal.nextAction'), day(deal.nextActionDue)],
        ]}
      />
      <Facts
        title={k('offer.title')}
        rows={[
          [
            k('offer.kind'),
            offer.kind === 'referral'
              ? k('offer.referral', { ...names, share: format.percent(offer.referralShareBp) })
              : k('offer.full', { name: names.to }),
            true,
          ],
          [k('offer.fee'), figure(offer.feeFils)],
          [
            handover.to.id === viewerId
              ? k('offer.youEarn')
              : k('offer.theyEarn', { name: names.to }),
            earning(preview, k, format.money),
          ],
        ]}
      />
      {property ? (
        <HandoverListing property={property} handoverId={handover.id} />
      ) : (
        <section className="agreement-facts">
          <h3>{k('property.title')}</h3>
          <p>{k('property.none')}</p>
        </section>
      )}
      <Facts title={k('client.title')} rows={[[k('client.name'), client.name]]} />
      <p className="finance-hint">{k('client.hidden', { name: names.to })}</p>
    </div>
  );
}
