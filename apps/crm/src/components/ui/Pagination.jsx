import React from 'react';

export function Pagination({
  total,
  page,
  pageSize = 12,
  label,
  itemLabel = 'records',
  onChange,
  variant = 'collection',
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages - 1);
  const position = `Page ${current + 1} of ${pages}`;
  return (
    <nav
      className={variant === 'table' ? 'table-footer' : 'collection-pagination'}
      aria-label={label || itemLabel + ' pagination'}
    >
      <span role="status">
        Showing {total ? current * pageSize + 1 : 0}–{Math.min((current + 1) * pageSize, total)} of{' '}
        {total} {itemLabel}
      </span>
      {(pages > 1 || variant === 'table') && (
        <div className="pager">
          <button type="button" disabled={current === 0} onClick={() => onChange(current - 1)}>
            Previous
          </button>
          <span>
            <span className="sr-only">{position}</span>
            <span aria-hidden="true">
              {variant === 'table' ? `${current + 1} / ${pages}` : position}
            </span>
          </span>
          <button
            type="button"
            disabled={current === pages - 1}
            onClick={() => onChange(current + 1)}
          >
            Next
          </button>
        </div>
      )}
    </nav>
  );
}
