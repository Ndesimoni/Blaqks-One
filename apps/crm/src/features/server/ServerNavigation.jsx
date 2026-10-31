import React from 'react';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useSession } from '../../hooks/useSession.js';
import { useNavigation, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { ProductRail } from './products/ProductRail.jsx';
import { visibleProducts } from './products/productModel.js';
import { SectionSidebar } from './products/SectionSidebar.jsx';
import './navigation.css';
import './products/products.css';

/**
 * The product rail and the current product's section sidebar (NAV). Wide screens show both,
 * the sidebar hidden when the person chose so; narrow screens show them in a drawer.
 */
export function ServerNavigation({ nav }) {
  const { user } = useSession();
  const { route, navigate } = useNavigation();
  const { mobileNav, setMobileNav } = useWorkspaceView();
  const mobile = useMediaQuery('(max-width: 1050px)');
  const products = visibleProducts(user);
  const current = nav.here?.product || null;
  const select = (name) => {
    navigate(name);
    setMobileNav(false);
  };
  const sidebar = (
    <SectionSidebar user={user} product={current} here={nav.here} route={route} navigate={select} />
  );
  if (!mobile)
    return (
      <>
        <ProductRail
          products={products}
          current={current}
          sidebarOpen={nav.sectionsVisible}
          home={route === 'Start'}
          onHome={() => navigate('Start')}
          onOpen={nav.openProduct}
        />
        {nav.sectionsVisible && sidebar}
      </>
    );
  if (!mobileNav) return null;
  return (
    <Drawer
      className="navigation-drawer product-drawer"
      placement="side"
      titleId="connected-navigation-title"
      onClose={() => setMobileNav(false)}
    >
      <h2 id="connected-navigation-title" className="sr-only">
        CRM navigation
      </h2>
      <ProductRail
        products={products}
        current={current}
        home={route === 'Start'}
        onHome={() => select('Start')}
        sidebarOpen
        onOpen={(key) => key !== current && nav.openProduct(key)}
      />
      {current && sidebar}
      <button
        className="navigation-close"
        aria-label="Close navigation"
        onClick={() => setMobileNav(false)}
      >
        <Icon name="close" size={20} />
      </button>
    </Drawer>
  );
}
