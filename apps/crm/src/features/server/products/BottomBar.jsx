import React, { useState } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { START_ROUTE } from './startModel.js';
import './bottom-bar.css';

const KEY = 'kws-bottom-bar';
const BAR_PRODUCTS = ['crm', 'web', 'platform', 'market', 'messages'];

// Hiding the bar is a per-viewer convenience; storage may be unavailable.
const readShown = () => {
  try {
    return localStorage.getItem(KEY) !== 'hidden';
  } catch {
    return true;
  }
};
const saveShown = (shown) => {
  try {
    localStorage.setItem(KEY, shown ? 'shown' : 'hidden');
  } catch {
    // Not remembered; the choice applies until the page reloads.
  }
};

/**
 * The phone bottom bar (NAV4, owner 2026-10-31): Home and up to four products. Tapping the
 * current product opens its sections; the X hides the bar and a round button brings it back.
 * Shown only on narrow screens (products.css).
 */
export function BottomBar({ products, current, route, onOpen, onHome, onSections }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(readShown);
  const show = (value) => {
    setShown(value);
    saveShown(value);
  };
  if (!shown)
    return (
      <button
        type="button"
        className="bottom-bar-open"
        aria-label={t('products.showBar')}
        onClick={() => show(true)}
      >
        <Icon name="grid" size={20} />
      </button>
    );
  const keys = BAR_PRODUCTS.filter((key) => products.some((product) => product.key === key));
  const item = (key, icon, label, here, onClick) => (
    <button
      type="button"
      key={key}
      className={here ? 'active' : undefined}
      aria-current={here ? 'page' : undefined}
      onClick={onClick}
    >
      <Icon name={icon} size={20} />
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="bottom-bar" aria-label={t('products.bar')}>
      {item('home', 'home', t('start.home'), route === START_ROUTE, onHome)}
      {keys.slice(0, 4).map((key) => {
        const product = products.find((entry) => entry.key === key);
        const here = key === current;
        return item(key, product.icon, t(`products.${key}`), here, () =>
          here ? onSections() : onOpen(key),
        );
      })}
      <button
        type="button"
        className="bottom-bar-hide"
        aria-label={t('products.hideBar')}
        onClick={() => show(false)}
      >
        <Icon name="close" size={16} />
      </button>
    </nav>
  );
}
