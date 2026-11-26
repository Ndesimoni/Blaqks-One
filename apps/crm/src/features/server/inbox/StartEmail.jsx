import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { StartEmailForm } from './StartEmailForm.jsx';

/**
 * New email (Start message, E1b/E1d) in its own drawer: the Inbox's New email and a
 * calculator's summary. On success the new conversation opens; see StartEmailForm.
 */
export function StartEmail({ onClose, ...form }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <Drawer className="inbox-start" titleId={`${id}-title`} onClose={onClose}>
      <StartTop id={`${id}-title`} title={t('inboxSend.start.title')} onClose={onClose} />
      <StartEmailForm {...form} />
    </Drawer>
  );
}

/** A Start message drawer's title and close button. */
export function StartTop({ id, title, onClose }) {
  const { t } = useI18n();
  return (
    <div className="drawer-top">
      <h2 id={id}>{title}</h2>
      <Button
        variant="light"
        icon="close"
        aria-label={t('inboxSend.start.close')}
        onClick={onClose}
      />
    </div>
  );
}
