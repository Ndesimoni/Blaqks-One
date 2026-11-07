import type { Agent, Area, Catalogue, Company, Developer, Listing, Site } from './types.ts';
import { isPublicMedia } from './public-assets.ts';
import { publicContent } from './public-content.ts';
import { publicSocial } from './social-links.ts';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Invalid public API response.');
  return value as Record<string, unknown>;
}
function text(row: Record<string, unknown>, key: string, optional = false): string {
  if (optional && row[key] == null) return '';
  if (typeof row[key] !== 'string' || row[key].length > 16000)
    throw Error(`Invalid public ${key}.`);
  return row[key];
}
function number(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw Error(`Invalid public ${key}.`);
  return value;
}
export function publicImage(value: string): string {
  if (isPublicMedia(value)) return value;
  try {
    const url = new URL(value, 'https://public.invalid');
    if (url.pathname.toLowerCase().startsWith('/api/')) throw Error('Private API asset.');
    if (/^\/(?!\/)[a-zA-Z0-9/_.,%-]+$/.test(value)) return value;
    if (/^https:\/\//i.test(value) && !url.username && !url.password) return value;
  } catch {}
  throw Error('Invalid public image URL.');
}
function strings(row: Record<string, unknown>, key: string, max: number): string[] {
  const value = row[key];
  if (!Array.isArray(value) || value.length > max || value.some((v) => typeof v !== 'string'))
    throw Error(`Invalid public ${key}.`);
  return value;
}
export function decodeListing(value: unknown): Listing {
  const row = object(value),
    result: Record<string, unknown> = {};
  for (const key of [
    'id',
    'agent',
    'company',
    'developer',
    'area',
    'title',
    'type',
    'purpose',
    'emirate',
    'category',
    'description',
    'ready',
    'furnishing',
    'market',
    'publishedAt',
    'reference',
  ])
    result[key] = text(row, key);
  for (const key of ['bathrooms', 'size', 'price', 'parking', 'guests', 'minimumStay'])
    result[key] = number(row, key);
  result.bedrooms = row.bedrooms === null ? null : number(row, 'bedrooms');
  result.image = publicImage(text(row, 'image'));
  result.photos = strings(row, 'photos', 20).map(publicImage);
  result.floorPlans = strings(row, 'floorPlans', 3).map(publicImage);
  result.amenities = strings(row, 'amenities', 30);
  if (row.advertisingPermit != null) result.advertisingPermit = text(row, 'advertisingPermit');
  return result as Listing;
}
export function decodeEntity(kind: string, value: unknown): Company | Agent | Area | Developer {
  const fields: Record<string, string[]> = {
    companies: ['id', 'name', 'mark', 'area', 'note'],
    agents: ['id', 'name', 'company', 'specialty'],
    areas: ['id', 'name', 'city', 'emirate', 'image', 'note'],
    developers: ['id', 'name', 'emirate'],
  };
  if (!Object.hasOwn(fields, kind)) throw Error('Invalid public entity.');
  const row = object(value),
    result: Record<string, unknown> = {};
  for (const key of fields[kind])
    result[key] = key === 'image' ? publicImage(text(row, key)) : text(row, key);
  if (row.publicListingCount != null) result.publicListingCount = number(row, 'publicListingCount');
  if (kind === 'companies' && row.publicAgentCount != null)
    result.publicAgentCount = number(row, 'publicAgentCount');
  if (kind === 'agents') {
    for (const key of ['publicWhatsApp', 'publicEmail']) result[key] = text(row, key, true);
    const social = publicSocial(row.social);
    if (social) result.social = social;
  }
  if (kind === 'developers') {
    const website = text(row, 'website', true);
    result.website = website && new URL(website).protocol === 'https:' ? website : '';
  }
  return result as Company | Agent | Area | Developer;
}
export function decodeCatalogue(value: unknown): Catalogue {
  const row = object(value),
    result: Record<string, unknown> = {};
  for (const key of ['listings', 'companies', 'agents', 'areas', 'developers']) {
    const entries = row[key] ?? [];
    if (!Array.isArray(entries) || entries.length > 500) throw Error('Invalid public collection.');
    result[key] = entries.map((entry) =>
      key === 'listings' ? decodeListing(entry) : decodeEntity(key, entry),
    );
  }
  return result as Catalogue;
}
export function decodeSite(value: unknown): Site {
  const row = object(value);
  if (
    !['platform', 'company'].includes(String(row.kind)) ||
    !['1', '2', '3', '4'].includes(String(row.theme))
  )
    throw Error('Invalid public site.');
  const company = row.company === null ? null : text(row, 'company');
  if ((row.kind === 'company') !== Boolean(company)) throw Error('Invalid site company.');
  const content = publicContent(row.content);
  const social = publicSocial((row.content as Record<string, unknown> | null)?.social);
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    kind: row.kind as Site['kind'],
    company,
    theme: row.theme as Site['theme'],
    sample: false,
    content,
    ...(social && { social }),
  };
}
