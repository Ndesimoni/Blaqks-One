import type { Area } from './types.ts';

const communities: Record<string, { bounds: string; view: string; emirate: string }> = {
  marina: { bounds: '55.124,25.062,55.159,25.099', view: '14/25.0805/55.1415', emirate: 'dubai' },
  hills: { bounds: '55.216,25.072,55.272,25.127', view: '13/25.0995/55.2440', emirate: 'dubai' },
  saadiyat: {
    bounds: '54.386,24.508,54.477,24.572',
    view: '13/24.5400/54.4315',
    emirate: 'abu-dhabi',
  },
};
export function communityView(area?: Area) {
  const known = area?.name.trim().toLowerCase();
  const key =
    known === 'dubai marina'
      ? 'marina'
      : ['dubai hills', 'dubai hills estate'].includes(known || '')
        ? 'hills'
        : known === 'saadiyat island'
          ? 'saadiyat'
          : area?.id || '';
  const candidate = Object.hasOwn(communities, key) ? communities[key] : undefined;
  return candidate?.emirate === area?.emirate ? candidate : undefined;
}
