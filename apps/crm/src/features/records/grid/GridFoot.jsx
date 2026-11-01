import React from 'react';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { N } from '../../../lib/format.js';

/** Grid footer (Bitrix24 list pattern): the filtered total, then the page range and pager. */
export function GridFoot({ total, page, perPage, label, onPage }) {
  const { t } = useI18n();
  return (
    <div className="grid-foot">
      <p className="grid-total">
        {t('recordGrid.total')} <strong>{N(total)}</strong>
      </p>
      <Pagination
        variant="table"
        total={total}
        page={page}
        pageSize={perPage}
        label={label}
        onChange={onPage}
      />
    </div>
  );
}
