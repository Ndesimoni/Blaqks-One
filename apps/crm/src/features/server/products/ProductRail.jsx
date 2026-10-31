import React from 'react';
import { BrandMark } from '../../../components/layout/BrandMark.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { BOTTOM_PRODUCT } from './productModel.js';

/**
 * The slim product rail (NAV): one button per product this person may open, Settings at the
 * bottom. The current product's button also hides or shows its section sidebar.
 */
export function ProductRail({ products, current, sidebarOpen, onOpen }) {
  const { t } = useI18n();
  const button = (product) => {
    const here = product.key === current;
    const label = t(`products.${product.key}`);
    return (
      <button
        type="button"
        key={product.key}
        className={'rail-item' + (here ? ' active' : '')}
        aria-current={here ? 'page' : undefined}
        aria-expanded={here ? sidebarOpen : undefined}
        aria-controls={here ? 'section-sidebar' : undefined}
        title={here ? t(sidebarOpen ? 'products.hideSections' : 'products.showSections') : label}
        onClick={() => onOpen(product.key)}
      >
        <Icon name={product.icon} size={20} />
        <span>{label}</span>
      </button>
    );
  };
  const bottom = products.find((product) => product.key === BOTTOM_PRODUCT);
  return (
    <nav className="product-rail" aria-label={t('products.rail')}>
      <div className="rail-brand" aria-hidden="true">
        <BrandMark />
      </div>
      {products.filter((product) => product.key !== BOTTOM_PRODUCT).map(button)}
      <span className="rail-spacer" />
      {bottom && button(bottom)}
    </nav>
  );
}
