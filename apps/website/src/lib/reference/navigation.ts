import type { PageData } from '../types';
import { referenceIdentity } from './identity.ts';

export function alias(data: PageData, kind: string, id: string) {
  return referenceIdentity(data.site.id + ':' + kind, id, data.site.sample);
}

export function referenceRoute(data: PageData): string {
  const page = data.page;
  if (data.entity && ['property', 'agent', 'company'].includes(page))
    return page + '/' + alias(data, page, data.entity.id);
  if (page === 'company-setup') return 'company';
  if (page === 'enquiry') return 'contact';
  return page;
}

export function publicDestination(hash: string, data: PageData): string | null {
  const [route, search = ''] = hash.replace(/^#/, '').split('?');
  const [kind, id] = route.split('/');
  if (id && ['areas', 'developers'].includes(kind))
    return '/' + kind + '/' + encodeURIComponent(id);
  const collections = {
    property: data.catalogue.listings,
    agent: data.catalogue.agents,
    company: data.catalogue.companies,
  };
  if (id && Object.hasOwn(collections, kind)) {
    const list = collections[kind as keyof typeof collections];
    const item = list.find((p) => alias(data, kind, p.id) === Number(id));
    if (!item) return null;
    const resource = kind === 'property' ? 'properties' : kind === 'agent' ? 'agents' : 'companies';
    return '/' + resource + '/' + encodeURIComponent(item.id);
  }
  if (route === 'home') return '/';
  if (route === 'company') return '/company-setup';
  const allowed = [
    'properties',
    'agents',
    'companies',
    'deals',
    'distress-deals',
    'discount-deals',
    'areas',
    'developers',
    'privacy',
    'terms',
    'about',
    'contact',
    'help',
    'professionals',
    'saved',
    'recent',
    'compare',
    'signup',
    'signin',
    'verify',
    'invite',
    'ready',
    'workspace',
    'reset',
    'reset-sent',
    'expired',
  ];
  if (!allowed.includes(route)) return null;
  return '/' + route + (search ? '?' + search : '');
}
