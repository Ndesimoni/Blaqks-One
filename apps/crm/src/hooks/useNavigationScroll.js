import { useEffect } from 'react';

export function useNavigationScroll(sidebarRef, route, open) {
  useEffect(() => {
    const list = sidebarRef.current?.querySelector('.nav-groups');
    const current = list?.querySelector('[aria-current="page"]');
    if (!current) return;
    const item = current.getBoundingClientRect();
    const viewport = list.getBoundingClientRect();
    if (item.top >= viewport.top && item.bottom <= viewport.bottom) return;
    list.scrollBy({
      top: item.top - viewport.top - (list.clientHeight - item.height) / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [sidebarRef, route, open]);
}
