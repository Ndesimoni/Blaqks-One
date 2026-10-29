import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Query } from './types.ts';
import { currentSite } from './site.ts';
import { websiteRoute } from './routing.ts';
import { sampleCatalogue } from './sample-catalogue.ts';
import { samplePage } from './page-model.ts';
import { livePage } from './live-page.ts';
import { PublicNotFound } from './public-api.ts';

export const loadPage = cache(async (pathname: string, serializedQuery: string) => {
  const route = websiteRoute(pathname ? pathname.split('/') : []);
  if (!route) notFound();
  const { site, host } = await currentSite();
  const query = JSON.parse(serializedQuery) as Query;
  if (site.sample) {
    const data = samplePage(site, sampleCatalogue(site), route.page, query, route.id);
    if (!data) notFound();
    return data;
  }
  try {
    return await livePage(site, host, route.page, query, route.id);
  } catch (error) {
    if (error instanceof PublicNotFound) notFound();
    throw error;
  }
});
