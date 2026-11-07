import React from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';
import { SOCIAL_FIELDS } from './socialModel.js';
import './social-links.css';

/**
 * Saved or about-to-publish links, read-only. Each address is plain text, never a link
 * (review L3), so nothing in the CRM opens an address someone else typed.
 */
export function SocialLinkList({ values, title }) {
  const { t } = useI18n();
  const links = SOCIAL_FIELDS.filter(
    (field) => typeof values?.[field] === 'string' && values[field],
  );
  return (
    <div className="social-list">
      {title && <p className="social-list-title">{title}</p>}
      {links.length ? (
        <dl>
          {links.map((field) => (
            <div key={field}>
              <dt>{t(`websiteSocial.field.${field}`)}</dt>
              <dd>{values[field]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="social-list-empty">{t('websiteSocial.notAdded')}</p>
      )}
    </div>
  );
}
