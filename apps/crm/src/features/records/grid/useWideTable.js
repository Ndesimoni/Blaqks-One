import { useEffect, useLayoutEffect, useState } from 'react';

// Measured before paint in the browser, so a wide table never flashes outside its card.
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * True when the table is wider than its card. Only then does the table scroll sideways inside
 * the card; a table that fits keeps its header row in view while the page scrolls, which a
 * sideways scroll area would prevent.
 */
export function useWideTable(ref) {
  const [wide, setWide] = useState(false);
  useBrowserLayoutEffect(() => {
    const box = ref.current;
    const table = box?.querySelector('table');
    if (!box || !table) return undefined;
    const measure = () => setWide(table.offsetWidth > box.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(table);
    return () => observer.disconnect();
  }, [ref]);
  return wide;
}
