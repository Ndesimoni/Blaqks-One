import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { normalizeHost, sampleSite } from './host.ts';
import { publicGet, PublicNotFound } from './public-api.ts';
import { decodeSite } from './public-shapes.ts';

export const currentSite = cache(async () => {
  const incoming = await headers();
  const host = normalizeHost(incoming.get('host') || '');
  if (!host) notFound();
  const mode = process.env.WEBSITE_DATA_MODE || 'api';
  if (mode === 'sample') {
    const site = sampleSite(host);
    if (!site) notFound();
    return { site, host };
  }
  if (mode !== 'api') throw Error('Unknown website data mode.');
  try {
    const response = await publicGet('sites/resolve', host);
    return { site: decodeSite(response.data), host };
  } catch (error) {
    if (error instanceof PublicNotFound) notFound();
    throw error;
  }
});
