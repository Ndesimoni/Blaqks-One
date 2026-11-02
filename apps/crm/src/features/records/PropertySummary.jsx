import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { readableDate } from '../../lib/dates.js';
import { maskPhone, N } from '../../lib/format.js';
import { get } from '../../lib/records.js';
import './panel/record-panel-cards.css';
import './property-summary.css';

const joined = (...values) =>
  values
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' · ');
const counted = (value, word) => (String(value ?? '').trim() ? `${value} ${word}` : '');

/**
 * The mockup's listing summary at the top of the record slider: the key facts, then what only
 * the CRM keeps (the owner from the linked contact with the phone masked as in the mockup, the
 * unit, how to view it). The owner shows only when that contact is in the viewer's loaded
 * records; the full number stays on the contact. The full field list stays below.
 */
export function PropertySummary({ record: r, data }) {
  const { t } = useI18n();
  const area = get(r, 'Area sq ft');
  const facts = [
    ['type', joined(get(r, 'Property type'), get(r, 'Sale / rental'))],
    [
      'size',
      joined(
        counted(get(r, 'Bedrooms'), 'bed'),
        counted(get(r, 'Bathrooms'), 'bath'),
        area ? `${N(area)} sq ft` : '',
      ),
    ],
    ['area', joined(get(r, 'Community'), get(r, 'Emirate'))],
    ['ready', get(r, 'Ready / off-plan')],
    ['furnishing', get(r, 'Furnishing')],
    ['available', get(r, 'Available from') ? readableDate(get(r, 'Available from')) : ''],
  ].filter(([, value]) => value);
  const ownerId = String(get(r, 'Contact ID') ?? '').trim();
  const owner =
    ownerId &&
    (data?.Contacts || []).find((contact) => String(get(contact, 'Contact ID') ?? '') === ownerId);
  const kept = [
    owner &&
      t('recordPanel.owner', {
        owner: joined(get(owner, 'Full name'), maskPhone(get(owner, 'Phone'))),
      }),
    joined(
      get(r, 'Building / project'),
      get(r, 'Unit reference') && `Unit ${get(r, 'Unit reference')}`,
    ),
    get(r, 'Viewing instructions'),
  ].filter(Boolean);
  return (
    <div className="property-summary">
      {facts.length > 0 && (
        <dl className="record-fact-card property-summary-facts">
          {facts.map(([key, value]) => (
            <div key={key}>
              <dt>{t(`recordPanel.fact${key[0].toUpperCase()}${key.slice(1)}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {kept.length > 0 && (
        <div className="property-private-box">
          <span className="property-private-label">
            <Icon name="lock" size={15} />
            {t('recordPanel.privateBox')}
          </span>
          {kept.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      )}
    </div>
  );
}
