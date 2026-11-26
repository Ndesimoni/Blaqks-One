'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PageData } from '../../lib/types';
import { publicFilterQuery } from '../../lib/reference/queries';

export function usePublicFilters(data: PageData) {
  const router = useRouter();
  useEffect(() => {
    if (data.site.sample) return;
    let timer: ReturnType<typeof setTimeout>;
    const search = () => {
      const form = document.querySelector<HTMLFormElement>('#listing-filter-form');
      if (!form) return;
      router.replace('/properties?' + publicFilterQuery(form, data), { scroll: false });
    };
    const change = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.id === 'u-directory-search') {
        clearTimeout(timer);
        timer = setTimeout(
          () =>
            router.replace(
              '/' + data.page + '?q=' + encodeURIComponent((target as HTMLInputElement).value),
            ),
          350,
        );
        return;
      }
      if (!target.closest('#listing-filter-form, #l-search, #l-sort')) return;
      clearTimeout(timer);
      timer = setTimeout(search, 350);
    };
    const click = (event: MouseEvent) => {
      const page = (event.target as HTMLElement).closest<HTMLElement>('[data-public-page]');
      if (page) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const params = new URLSearchParams(data.query as Record<string, string>);
        params.set('page', page.dataset.publicPage!);
        router.push('/agents?' + params);
        return;
      }
      if ((event.target as HTMLElement).closest('[data-l-purpose]')) {
        clearTimeout(timer);
        timer = setTimeout(search, 0);
      }
    };
    const submit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      if (form.id !== 'header-property-search' && form.id !== 'property-search') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const values = new FormData(form);
      const params = new URLSearchParams();
      const query = values.get('q');
      if (query) params.set('q', String(query));
      if (values.get('type') && values.get('type') !== 'All property types')
        params.set('type', String(values.get('type')));
      router.push('/properties?' + params);
    };
    document.addEventListener('change', change);
    document.addEventListener('input', change);
    document.addEventListener('click', click, true);
    document.addEventListener('submit', submit, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('change', change);
      document.removeEventListener('input', change);
      document.removeEventListener('click', click, true);
      document.removeEventListener('submit', submit, true);
    };
  }, [data, router]);
}
