import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { useI18n } from '../../i18n/useI18n.js';

export function BotCheck({ mode }) {
  const { t } = useI18n();
  if (mode !== 'local') return null;
  return (
    <p className="signup-bot-note">
      <Icon name="shield" size={15} /> {t('signup.botLocal')}
    </p>
  );
}
