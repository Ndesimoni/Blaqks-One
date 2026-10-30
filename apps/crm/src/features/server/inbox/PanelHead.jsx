import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/** The side panel's header on phones and in the overlay: back to the conversation. */
export function PanelHead({ title, onClose }) {
  const { t } = useI18n();
  return (
    <header className="inbox-panel-head">
      <button
        type="button"
        className="inbox-icon-button inbox-back"
        aria-label={t('inbox.panel.close')}
        onClick={onClose}
      >
        <Icon name="arrow" size={18} />
      </button>
      <h2>{title}</h2>
    </header>
  );
}
