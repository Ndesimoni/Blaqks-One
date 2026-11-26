import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/** A message's photos (previews that open full size) and files (download links). */
export function MessageFiles({ files = [], urlOf }) {
  const { t } = useI18n();
  if (!files.length) return null;
  return (
    <ul className="chat-attachments">
      {files.map((file) => {
        const url = urlOf(file.id);
        const photo = file.contentType.startsWith('image/');
        return (
          <li key={file.id} className={photo ? 'is-photo' : 'is-file'}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('chat.files.open', { name: file.name })}
            >
              {photo ? (
                <img src={url} alt={file.name} loading="lazy" />
              ) : (
                <>
                  <Icon name="note" size={18} />
                  <bdi>{file.name}</bdi>
                </>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
