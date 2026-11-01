import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { OWN_HEADING, pageTitle } from './pageTitle.js';

/**
 * The top bar's page name (NAV5, Bitrix24's header): the product, then the page as its one
 * main heading. Pages with a heading of their own get the name as plain text instead.
 */
export function HeaderTitle({ user, route, product }) {
  const { t } = useI18n();
  const Name = OWN_HEADING.includes(route) ? 'strong' : 'h1';
  return (
    <div className="header-title">
      {product && <span className="header-crumb">{t(`products.${product}`)} /</span>}
      <Name className="header-page">{pageTitle(route, user, t)}</Name>
    </div>
  );
}
