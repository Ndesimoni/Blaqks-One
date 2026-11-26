import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { pageNumbers } from './pagerModel.js';

/**
 * The grid's pager (the approved mockup's footer): numbered pages and the page size, shown once
 * there is a second page. The range stays as a status for screen readers.
 */
export function GridPager({ total, page, perPage, label, onPage }) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(page, pages - 1);
  const first = total ? current * perPage + 1 : 0;
  const last = Math.min((current + 1) * perPage, total);
  return (
    <nav className="grid-pager" aria-label={label}>
      <span className="sr-only" role="status">
        {t('recordGrid.showing', { first, last, total })}
      </span>
      {pages > 1 && (
        <>
          <span className="grid-pages">
            {pageNumbers(pages, current).map((number) =>
              typeof number === 'string' ? (
                <span key={number} className="grid-page-gap" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={number}
                  type="button"
                  aria-label={t('recordGrid.page', { page: number + 1 })}
                  aria-current={number === current ? 'page' : undefined}
                  onClick={() => onPage(number)}
                >
                  {number + 1}
                </button>
              ),
            )}
          </span>
          <span className="grid-rows">{t('recordGrid.rowsPerPage', { count: perPage })}</span>
        </>
      )}
    </nav>
  );
}
