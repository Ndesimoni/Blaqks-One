import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { N } from '../../../lib/format.js';
import { GridPager } from './GridPager.jsx';
import './grid-foot.css';

/** The mockup's grid footer: "Total: N" on the left, the numbered pages and page size beside it. */
export function GridFoot({ total, page, perPage, label, onPage }) {
  const { t } = useI18n();
  return (
    <div className="grid-foot">
      <p className="grid-total">
        {t('recordGrid.total')} <strong>{N(total)}</strong>
      </p>
      <GridPager total={total} page={page} perPage={perPage} label={label} onPage={onPage} />
    </div>
  );
}
