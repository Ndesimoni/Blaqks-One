import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * What a share link shows (amendment 7): the type, the label, who shared it (and with whom,
 * for its other parties), the dates and the status. A closed share has no label.
 */
export function ShareFacts({ share, me }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`recordShares.${key}`, vars);
  const facts = [
    ['type', k(`type.${share.collection}`)],
    ['record', share.label || k('hiddenLabel')],
    ['from', share.from.name],
    share.to.id !== me && ['to', share.to.name],
    ['sent', format.dateTime(share.createdAt)],
    share.expiresAt && ['answerBy', format.dateTime(share.expiresAt)],
    ['status', k(`status.${share.status}`)],
  ].filter(Boolean);
  return (
    <dl className="finance-facts record-share-facts">
      {facts.map(([key, value]) => (
        <div className="finance-fact" key={key}>
          <dt>{k(`fact.${key}`)}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
