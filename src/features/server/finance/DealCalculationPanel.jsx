import React from 'react';
import { formatAed, formatPercent } from '../../../lib/finance/money.js';
import { splitSourceLabels } from './financeLabels.js';
import { lineLabel } from './dealFilters.js';

export const estimateLabel = 'Estimate. Final figures are fixed when the deal is earned.';

function Row({ label, value, strong = false, detail }) {
  return (
    <div className={'finance-row' + (strong ? ' strong' : '')}>
      <dt>
        {label}
        {detail && <small>{detail}</small>}
      </dt>
      <dd className="finance-money">{value}</dd>
    </div>
  );
}

/**
 * A deal's figures as the server shaped them (finance-design §5.3, §7). The team view lists
 * every line, the company share and the split source; the own view shows only "Your
 * commission" and, when an Admin adjusted it, "Adjusted by Admin" — never the reason.
 */
export function DealCalculationPanel({ calculation, team, override, secondAgent, title, chip }) {
  if (!calculation)
    return (
      <section className="finance-calc" aria-label="Commission">
        <h3>{title ?? 'Commission'}</h3>
        <p className="finance-hint">Figures appear once the fee terms are complete.</p>
      </section>
    );
  const calc = calculation;
  const own = calc.lines.find((line) => line.role === 'primary') ?? calc.lines[0];
  return (
    <section className="finance-calc" aria-label={title ?? 'Commission'}>
      <div className="finance-calc-head">
        <h3>{title ?? 'Commission'}</h3>
        <span className={'finance-chip' + (calc.preview && !chip ? ' estimate' : ' earned')}>
          {chip ?? (calc.preview ? 'Estimate' : `Earned · revision ${calc.revision ?? 1}`)}
        </span>
      </div>
      {calc.preview && !chip && <p className="finance-hint">{estimateLabel}</p>}
      <dl className="finance-rows">
        <Row label="Gross fee (ex VAT)" value={formatAed(calc.grossFils)} />
        <Row label="Partner share" value={formatAed(calc.partnerFils)} />
        <Row label="Net fee" value={formatAed(calc.netFils)} strong />
        <Row label="VAT on net fee" value={formatAed(calc.vatFils)} />
        {team ? (
          <>
            {calc.lines.map((line) => (
              <Row
                key={line.role}
                label={lineLabel(line, true)}
                detail={line.shareBp === null ? null : formatPercent(line.shareBp)}
                value={formatAed(line.amountFils)}
              />
            ))}
            <Row label="Company share" value={formatAed(calc.companyFils)} strong />
          </>
        ) : (
          <Row
            label="Your commission"
            value={own ? formatAed(own.amountFils) : 'No commission line'}
            strong
          />
        )}
      </dl>
      <ul className="finance-calc-notes">
        {team && calc.splitSource && <li>Split source: {splitSourceLabels[calc.splitSource]}</li>}
        {team && override && (
          <li>
            Override {formatPercent(override.agentShareBp)} · Reason: {override.reason}
          </li>
        )}
        {!team && calc.adjusted && <li>Adjusted by Admin</li>}
        {!team && secondAgent?.name && <li>Shared with {secondAgent.name}</li>}
        {team && secondAgent?.kind === 'referral' && <li>Second agent keeps a referral share</li>}
      </ul>
    </section>
  );
}
