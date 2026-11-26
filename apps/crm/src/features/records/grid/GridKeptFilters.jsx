import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import { useI18n } from '../../../i18n/useI18n.js';
import './grid-pills.css';

const phoneQuery = '(max-width: 750px)';

/**
 * The filters a page keeps beside the mockup's presets (pill selects, Assigned to, Clear
 * filters), as one labelled group: in the filter row on wider screens, and behind a Filters
 * button on phones so the first records stay in view.
 */
export function GridKeptFilters({ label, className = '', children }) {
  const { t } = useI18n();
  const phone = useMediaQuery(phoneQuery);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className={`grid-kept-filters ${className}`} role="group" aria-label={label}>
      {phone ? (
        <>
          <Button
            variant="light"
            icon="filter"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            {t('recordGrid.filters')}
          </Button>
          <div id={panelId} className="grid-more-filters" hidden={!open}>
            {children}
          </div>
        </>
      ) : (
        children
      )}
    </div>
  );
}
