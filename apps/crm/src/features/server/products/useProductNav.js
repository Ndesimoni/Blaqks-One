import { useCallback, useEffect, useRef, useState } from 'react';
import { locate, productEntry } from './productModel.js';
import { rememberRoute } from './startModel.js';

const SIDEBAR_KEY = 'kws-nav-sidebar';

// The sidebar choice is a per-viewer convenience; storage may be unavailable.
const readOpen = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== 'closed';
  } catch {
    return true;
  }
};
const saveOpen = (open) => {
  try {
    localStorage.setItem(SIDEBAR_KEY, open ? 'open' : 'closed');
  } catch {
    // Not remembered; the choice still applies until the page reloads.
  }
};

/**
 * Product navigation state (NAV): the current product follows the route, the section
 * sidebar can be hidden and is remembered per viewer, and each product reopens on the route
 * last used in it. Choosing the current product again hides or shows its sidebar.
 */
export function useProductNav(user, route, navigate) {
  const [sidebarOpen, setSidebarOpen] = useState(readOpen);
  const lastRoute = useRef({});
  const here = locate(user, route);
  if (here) lastRoute.current[here.product] = route;
  const inProduct = Boolean(here);
  useEffect(() => {
    if (inProduct) rememberRoute(route);
  }, [inProduct, route]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => {
      saveOpen(!open);
      return !open;
    });
  }, []);

  const openProduct = useCallback(
    (key) => {
      if (here?.product === key) return toggleSidebar();
      const target = productEntry(user, key, lastRoute.current[key]);
      if (!target) return undefined;
      setSidebarOpen(true);
      saveOpen(true);
      return navigate(target);
    },
    [here?.product, navigate, toggleSidebar, user],
  );

  // The start page has no sections, so the sidebar shows only inside a product.
  return {
    here,
    sidebarOpen,
    sectionsVisible: sidebarOpen && inProduct,
    toggleSidebar,
    openProduct,
  };
}
