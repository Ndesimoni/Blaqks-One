import React from 'react';
import { formatAed } from '../../../lib/finance/money.js';

/** The figures each view may see per row: own commission (own) or company share (team). */
export function rowFigures(deal, team) {
  const calc = deal.calculation;
  const own = calc?.lines.find((line) => line.role === 'primary') ?? calc?.lines[0];
  return {
    net: calc ? formatAed(calc.netFils) : '—',
    share: calc ? formatAed(team ? calc.companyFils : (own?.amountFils ?? null)) : '—',
    estimate: Boolean(calc?.preview),
  };
}

/**
 * Right-aligned tabular AED text. An unearned deal's figure is an estimate: quieter text with
 * an "Estimate" tag, so fixed earned figures stand out when scanning a column.
 */
export function Money({ value, estimate }) {
  return (
    <span className={'finance-money deal-money' + (estimate ? ' is-estimate' : '')}>
      {value}
      {estimate && <small className="finance-estimate-tag">Estimate</small>}
    </span>
  );
}
