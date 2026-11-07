import React from 'react';
import { formatAed, formatPercent } from '../../../lib/finance/money.js';
import { splitSourceLabels } from './financeLabels.js';
import { lineLabel } from './dealFilters.js';
import { DealChip, FigureChip } from './DealChips.jsx';

export const estimateLabel = 'Estimate. Final figures are fixed when the deal is earned.';

export function Row({ label, value, strong = false, detail, tone }) {
  return (
    <div className={'finance-row deal-row' + (strong ? ' strong' : '')} data-tone={tone}>
      <dt>
        <span>{label}</span>
        {detail && <small className="deal-row-share">{detail}</small>}
      </dt>
      <dd className="finance-money">{value}</dd>
    </div>
  );
}

/** The fee lines both views see: gross, partner share, net fee and VAT. */
export function FeeRows({ calc }) {
  return (
    <dl className="finance-rows deal-rows">
      <Row label="Gross fee (ex VAT)" value={formatAed(calc.grossFils)} />
      <Row label="Partner share" value={formatAed(calc.partnerFils)} />
      <Row label="Net fee" value={formatAed(calc.netFils)} strong />
      <Row label="VAT on net fee" value={formatAed(calc.vatFils)} />
    </dl>
  );
}

/**
 * A deal's figures as the server shaped them (finance-design §5.3, §7): the fee, then the
 * split. The team view lists one line per agent, the company share and the split source; the
 * own view shows only "Your commission" and, when an Admin adjusted it, "Adjusted by Admin" —
 * never the reason.
 */
export function DealCalculationPanel({ calculation, team, override, secondAgent, title, chip }) {
  const heading = title ?? 'Commission';
  if (!calculation)
    return (
      <section className="finance-calc deal-calc" aria-label={heading}>
        <h3>{heading}</h3>
        <p className="finance-hint">Figures appear once the fee terms are complete.</p>
      </section>
    );
  const calc = calculation;
  const own = calc.lines.find((line) => line.role === 'primary') ?? calc.lines[0];
  const notes = [
    team && calc.splitSource && `Split source: ${splitSourceLabels[calc.splitSource]}`,
    team &&
      override &&
      `Override ${formatPercent(override.agentShareBp)} · Reason: ${override.reason}`,
    !team && calc.adjusted && 'Adjusted by Admin',
    !team && secondAgent?.name && `Shared with ${secondAgent.name}`,
    team && secondAgent?.kind === 'referral' && 'Second agent keeps a referral share',
  ].filter(Boolean);
  return (
    <section className="finance-calc deal-calc" aria-label={heading}>
      <div className="finance-calc-head deal-calc-head">
        <h3>{heading}</h3>
        {chip ? (
          <DealChip tone="green" glyph="done">
            {chip}
          </DealChip>
        ) : (
          <FigureChip calculation={calc} />
        )}
      </div>
      {calc.preview && !chip && <p className="finance-hint deal-calc-hint">{estimateLabel}</p>}
      <FeeRows calc={calc} />
      <h4 className="deal-calc-sub">{team ? 'Commission split' : 'Your share'}</h4>
      <dl className="finance-rows deal-rows deal-split">
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
            <Row label="Company share" value={formatAed(calc.companyFils)} strong tone="total" />
          </>
        ) : (
          <Row
            label="Your commission"
            value={own ? formatAed(own.amountFils) : 'No commission line'}
            strong
            tone="total"
          />
        )}
      </dl>
      {notes.length > 0 && (
        <ul className="finance-calc-notes deal-calc-notes">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
