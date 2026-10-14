import React, { useMemo } from 'react';
import { formatAed } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { dealBodyFromDraft } from './dealDraft.js';
import { dealEstimate } from './dealEstimate.js';
import { lineLabel } from './dealFilters.js';
import { DealCalculationPanel, estimateLabel } from './DealCalculationPanel.jsx';

/**
 * The editor's live preview (finance-design §7), clearly labelled as an estimate. An earned
 * deal shows its fixed figures instead: they change only through an Admin revision.
 */
export function DealEstimatePanel({ form, deal }) {
  const { team, overview } = useFinanceContext();
  const estimate = useMemo(
    () =>
      dealEstimate(dealBodyFromDraft(form).body, {
        team,
        deal,
        settings: overview.settings,
        agreements: overview.myAgreements,
      }),
    [form, team, deal, overview.settings, overview.myAgreements],
  );
  if (deal?.earnedOn)
    return (
      <>
        <p className="finance-note" role="note">
          This deal is earned. Its commission changes only when your Admin revises it.
        </p>
        <DealCalculationPanel
          calculation={deal.calculation}
          team={team}
          override={deal.override}
          secondAgent={deal.secondAgent}
        />
      </>
    );
  return (
    <section className="finance-calc finance-estimate" aria-label="Estimate" aria-live="polite">
      <div className="finance-calc-head">
        <h3>Estimate</h3>
        <span className="finance-chip estimate">Estimate</span>
      </div>
      <p className="finance-hint">{estimateLabel}</p>
      {!estimate ? (
        <p className="finance-hint">Enter the agreed value and fee to see an estimate.</p>
      ) : (
        <dl className="finance-rows">
          {[
            ['Gross fee (ex VAT)', estimate.grossFils],
            ['Partner share', estimate.partnerFils],
            ['Net fee', estimate.netFils],
            ['VAT on net fee', estimate.vatFils],
          ].map(([label, value]) => (
            <div className={'finance-row' + (label === 'Net fee' ? ' strong' : '')} key={label}>
              <dt>{label}</dt>
              <dd className="finance-money">{formatAed(value)}</dd>
            </div>
          ))}
          {(estimate.lines ?? []).map((line) => (
            <div className="finance-row" key={line.role}>
              <dt>{lineLabel(line, team)}</dt>
              <dd className="finance-money">{formatAed(line.amountFils)}</dd>
            </div>
          ))}
        </dl>
      )}
      {estimate && !estimate.lines && (
        <p className="finance-hint">
          {team
            ? 'The commission split is estimated once the deal is saved with its holder.'
            : 'Your commission is confirmed by the server when the deal is saved.'}
        </p>
      )}
    </section>
  );
}
