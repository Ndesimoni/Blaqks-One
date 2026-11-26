'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PageData } from '../../lib/types';

// Community and developer search: debounced URL updates in sample and connected modes.
export function useDirectorySearch(data: PageData) {
  const router = useRouter();
  const page = data.page;
  const current = typeof data.query.q === 'string' ? data.query.q.trim() : '';
  useEffect(() => {
    if (page !== 'areas' && page !== 'developers') return;
    let timer: ReturnType<typeof setTimeout>;
    const input = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.id !== 'u-place-search') return;
      document.body.dataset.placeSearch = target.value;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const query = target.value.trim();
        if (query === current) {
          delete document.body.dataset.placeSearch;
          return;
        }
        router.replace('/' + page + (query ? '?q=' + encodeURIComponent(query) : ''), {
          scroll: false,
        });
      }, 350);
    };
    document.addEventListener('input', input);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('input', input);
    };
  }, [page, current, router]);
}
