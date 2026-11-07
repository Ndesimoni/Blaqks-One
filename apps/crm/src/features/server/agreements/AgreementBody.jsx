import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { AgreementEvidence, AgreementHistory, RevisionPicker } from './AgreementEvidence.jsx';
import { AgreementSummary } from './AgreementSummary.jsx';
import { AgreementTerms } from './AgreementTerms.jsx';
import { AgreementPayments } from './AgreementPayments.jsx';
import { DealParties } from '../finance/DealParties.jsx';

export function AgreementBody({ view, selected, onSelect }) {
  const { t } = useI18n();
  const { detail } = view;
  const { agreement, revision, proposal } = detail;
  const revisions = detail.revisions?.length ? detail.revisions : [revision];
  const shown = revisions.find((item) => item.number === selected) || revision;
  const acceptance = detail.events?.findLast(
    (event) => event.action === 'accepted' && event.revision === shown.number,
  );
  const names = Object.fromEntries(
    ['sender', 'recipient'].map((side) => [side, agreement.parties?.[side]?.name]),
  );
  return (
    <div className="drawer-body agreement-body">
      {view.notice && (
        <p
          className={`agreement-notice is-${view.notice.tone}`}
          role={view.notice.tone === 'error' ? 'alert' : 'status'}
        >
          {view.notice.key ? t(view.notice.key) : view.notice.message}
        </p>
      )}
      <AgreementSummary detail={detail} />
      {/* An in-company hand-over: its client and listing from the caller's own records (H3b). */}
      {detail.deal && (
        <DealParties
          deal={{ clientId: detail.deal.clientId, propertyId: detail.deal.propertyId }}
        />
      )}
      {proposal && (
        <section className="agreement-proposal">
          <h3>{t('agreementLifecycle.proposal', { number: proposal.number })}</h3>
          <p>{t('agreementLifecycle.current')}</p>
          <Button
            variant="light"
            onClick={() => onSelect(shown.id === proposal.id ? revision.number : proposal.number)}
          >
            {t(
              shown.id === proposal.id
                ? 'agreementLifecycle.showCurrent'
                : 'agreementLifecycle.reviewProposal',
            )}
          </Button>
        </section>
      )}
      {detail.lifecycle?.cancellation?.[detail.party] && (
        <p role="status">{t('agreementLifecycle.cancelWaiting')}</p>
      )}
      <RevisionPicker
        revisions={revisions}
        selected={shown.number}
        current={revision.number}
        accepted={acceptance?.revision}
        onSelect={onSelect}
      />
      <AgreementTerms terms={shown.terms} names={names} />
      <AgreementEvidence
        agreement={agreement}
        revision={shown}
        total={Math.max(...revisions.map((item) => item.number))}
        acceptance={acceptance}
        events={detail.events}
      />
      <AgreementPayments view={view} />
      <AgreementHistory agreement={agreement} events={detail.events} />
    </div>
  );
}
