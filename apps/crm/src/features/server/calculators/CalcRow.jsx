import React from 'react';

/** One label/value line in a calculator's Result card; `value` may be a badge. */
export function CalcRow({ label, value, strong = false }) {
  return (
    <div className={'calc-row' + (strong ? ' strong' : '')}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
