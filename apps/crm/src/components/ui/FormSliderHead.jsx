import React from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { Icon } from './Icon.jsx';
import './form-slider.css';
import './form-slider-steps.css';

/**
 * The header of a create or edit form slider (approved mockup): the title, "Fields marked *
 * are required" on the right and the close button beside the panel's edge. `focusTitle`
 * starts focus on the title instead of the first field.
 */
export function FormSliderHead({ titleId, title, closeLabel, busy, onClose, focusTitle }) {
  const { t } = useI18n();
  const [before, after] = t('recordPanel.requiredFields').split('*');
  return (
    <div className="drawer-top form-slider-head">
      <h2
        id={titleId}
        tabIndex={focusTitle ? -1 : undefined}
        data-initial-focus={focusTitle || undefined}
      >
        {title}
      </h2>
      <p className="form-slider-required">
        {before}
        <span className="required">*</span>
        {after}
      </p>
      <button
        type="button"
        className="icon-btn form-slider-close"
        aria-label={closeLabel}
        disabled={busy}
        onClick={onClose}
      >
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}
