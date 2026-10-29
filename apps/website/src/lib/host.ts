import type { Site } from './types.ts';
import { sampleCompanies } from './sample-people.ts';

export function normalizeHost(value: string): string | null {
  if (!value || value.length > 253 || /[\s/@\\?#,]/.test(value)) return null;
  if (!/^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(value)) return null;
  const [host, port] = value.toLowerCase().split(':');
  if (port && (Number(port) < 1 || Number(port) > 65535)) return null;
  if (!host || host.startsWith('.') || host.endsWith('.') || host.includes('..')) return null;
  return host;
}

export function sampleSite(host: string): Site | null {
  if (host === 'localhost' || host === '127.0.0.1')
    return {
      id: 'platform',
      kind: 'platform',
      name: 'Blaqks One',
      company: null,
      theme: '1',
      sample: true,
    };
  const themes: Record<string, Site['theme']> = {
    'harbour.localhost': '1',
    'harbour-modern.localhost': '2',
    'harbour-editorial.localhost': '3',
    'harbour-nocturne.localhost': '4',
    'cedar.localhost': '2',
    'dune.localhost': '4',
  };
  if (!Object.hasOwn(themes, host)) return null;
  const company = sampleCompanies.find((c) => c.id === host.split('.')[0].split('-')[0]);
  if (!company) return null;
  return {
    id: company.id,
    kind: 'company',
    name: company.name,
    company: company.id,
    theme: themes[host],
    sample: true,
  };
}
