import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/** Files waiting to be sent: uploading, ready or failed, each removable. */
export function ChosenFiles({ files }) {
  const { t } = useI18n();
  if (!files.items.length) return null;
  return (
    <ul className="chat-files" aria-label={t('chat.files.chosen')}>
      {files.items.map((item) => (
        <li key={item.key} className={'chat-file is-' + item.status}>
          <span>
            <bdi>{item.name}</bdi>
            {item.status !== 'ready' && (
              <small role={item.status === 'failed' ? 'alert' : undefined}>
                {item.status === 'uploading'
                  ? t('chat.files.uploading')
                  : t('chat.files.failed', { reason: item.error })}
              </small>
            )}
          </span>
          <button
            type="button"
            aria-label={t('chat.files.remove', { name: item.name })}
            onClick={() => files.remove(item.key)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
