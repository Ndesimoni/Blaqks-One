import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { productList } from './productModel.js';
import { CARD_FIGURES, actionLabel } from './startModel.js';

/** A row of figures: the count, then what it counts. */
export function StartFigures({ items }) {
  const { t } = useI18n();
  return (
    <div className="start-figures">
      {items.map(([count, key]) => (
        <div key={key}>
          <strong>{count}</strong>
          <span>{t(key, { count })}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * One product card as the approved mockup draws it: the mark and name, its figures (or its
 * line while none can be read), Open first, then the card's quick action.
 */
export function StartCard({ card, figures, crmFigures, onAction }) {
  const { t } = useI18n();
  const { key, actions } = card;
  const product = t(`products.${key}`);
  const shown = (CARD_FIGURES[key] ?? [])
    .filter(([name]) => Number.isInteger(figures[name]))
    .map(([name, label]) => [figures[name], label]);
  return (
    <article className="panel start-card" aria-labelledby={`start-${key}`}>
      <header>
        <span className="start-mark">
          <Icon name={productList.find((item) => item.key === key).icon} size={20} />
        </span>
        <h2 id={`start-${key}`}>{product}</h2>
      </header>
      {key === 'crm' ? (
        crmFigures
      ) : shown.length ? (
        <StartFigures items={shown} />
      ) : (
        <p>{t(`start.about.${key}`)}</p>
      )}
      <div className="start-actions">
        {actions.map((action, index) => (
          <Button
            key={action}
            variant={index ? 'light' : 'primary'}
            onClick={() => onAction(action)}
          >
            {index ? actionLabel(action, t) : t('start.open', { product })}
          </Button>
        ))}
      </div>
    </article>
  );
}
