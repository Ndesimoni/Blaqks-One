import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import './guidance-setting.css';
import { useGuidanceSave } from './useGuidanceSave.js';

/**
 * My profile field guidance (packet Q1): one switch for automatic hints. The information
 * icon beside a field stays available whether this is on or off.
 */
export function GuidanceSetting({ api, account, onSaved }) {
  const { t } = useI18n();
  const save = useGuidanceSave(api, onSaved);
  const saved = account.user.guidanceEnabled !== false;
  const enabled = save.status === 'saving' ? save.pending : saved;
  return (
    <div className="panel acct-card">
      <div className="acct-card-body">
        <label className="guidance-switch">
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            disabled={save.status === 'saving'}
            onChange={(event) => save.choose(event.target.checked)}
          />
          <span>{t('profile.guidance.label')}</span>
        </label>
        <p className="guidance-note">{t('profile.guidance.help')}</p>
        {save.status === 'error' && (
          <div className="acct-alert" role="alert">
            <p className="field-error">{t('profile.guidance.error')}</p>
            <Button variant="light" onClick={save.retry}>
              {t('common.language.retry')}
            </Button>
          </div>
        )}
        <div aria-live="polite">
          {save.status === 'saving' && (
            <p className="guidance-note">{t('profile.guidance.saving')}</p>
          )}
          {save.status === 'saved' && (
            <p className="acct-success">
              <Icon name="check" size={15} />
              {t(enabled ? 'profile.guidance.savedOn' : 'profile.guidance.savedOff')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
