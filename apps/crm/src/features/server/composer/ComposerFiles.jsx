import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

const PHOTO = /\.(jpe?g|png|webp)$/i;

/** The file type shown under a ready file's name, such as PDF or JPG. */
function kind(name) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : '';
}

/** One chosen file: its name, then Uploading…, its type, or why it failed; removable. */
function FileChip({ item, onRemove }) {
  const { t } = useI18n();
  const failed = item.status === 'failed';
  return (
    <li className={'composer-file is-' + item.status} title={item.name}>
      <span className="composer-file-icon" aria-hidden="true">
        <Icon name={failed ? 'info' : PHOTO.test(item.name) ? 'image' : 'note'} size={16} />
      </span>
      <span className="composer-file-text">
        <bdi>{item.name}</bdi>
        <small role={failed ? 'alert' : undefined} title={failed ? item.error : undefined}>
          {item.status === 'uploading'
            ? t('chat.files.uploading')
            : failed
              ? t('chat.files.failed', { reason: item.error })
              : kind(item.name)}
        </small>
      </span>
      <button
        type="button"
        className="composer-file-remove"
        aria-label={t('chat.files.remove', { name: item.name })}
        onClick={() => onRemove(item.key)}
      >
        <Icon name="close" size={14} strokeWidth={2} />
      </button>
      {item.status === 'uploading' && <span className="composer-file-progress" />}
    </li>
  );
}

/** Files waiting to be sent, shown inside the composer box above the text. */
export function ComposerFiles({ files }) {
  const { t } = useI18n();
  if (!files.items.length) return null;
  return (
    <ul className="composer-files" aria-label={t('chat.files.chosen')} aria-live="polite">
      {files.items.map((item) => (
        <FileChip key={item.key} item={item} onRemove={files.remove} />
      ))}
    </ul>
  );
}
