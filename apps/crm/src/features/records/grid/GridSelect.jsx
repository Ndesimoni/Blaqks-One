import React, { useEffect, useRef } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import './grid-selection.css';

/** The heading checkbox: ticks the page's rows; partly ticked shows as mixed. */
export function SelectPageCell({ rows, selection }) {
  const { t } = useI18n();
  const box = useRef(null);
  const ticked = rows.filter(selection.isSelected).length;
  useEffect(() => {
    if (box.current) box.current.indeterminate = ticked > 0 && ticked < rows.length;
  });
  return (
    <th scope="col" className="grid-select">
      <input
        ref={box}
        type="checkbox"
        aria-label={t('recordGrid.selectPage')}
        checked={rows.length > 0 && ticked === rows.length}
        disabled={!rows.length}
        onChange={() => selection.togglePage(rows)}
      />
    </th>
  );
}

/** A row's checkbox; ticking it never opens the record the row belongs to. */
export function SelectRowCell({ record, name, selection }) {
  const { t } = useI18n();
  return (
    <td className="grid-select" onClick={(event) => event.stopPropagation()}>
      <input
        type="checkbox"
        aria-label={t('recordGrid.selectRow', { name })}
        checked={selection.isSelected(record)}
        onChange={() => selection.toggle(record)}
      />
    </td>
  );
}
