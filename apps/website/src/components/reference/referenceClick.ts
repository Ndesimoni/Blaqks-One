import type { PageData } from '../../lib/types';
import { alias } from '../../lib/reference/navigation';

type Navigate = (href: string) => void;

const plainClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// Footer "Buy a property" style shortcuts keep their purpose filter on the real results URL.
function footerDestination(kind: string | undefined, sample: boolean): string | null {
  const live: Record<string, string> = {
    Buy: 'purpose=buy',
    Rent: 'purpose=rent',
    Commercial: 'category=commercial',
  };
  if (kind === 'listings') return '/properties';
  if (!kind || !live[kind]) return null;
  return '/properties?' + (sample ? 'purpose=' + kind : live[kind]);
}

function internalLink(target: HTMLElement): string | null {
  const link = target.closest<HTMLAnchorElement>('#app a[href^="/"]:not([href^="//"])');
  const href = link?.getAttribute('href');
  if (!link || !href || link.target || link.hasAttribute('download')) return null;
  return /^\/(?:approved|api)\//.test(href) ? null : href;
}

export function referenceClick(
  event: MouseEvent,
  data: PageData,
  crm: string | null,
  navigate: Navigate,
) {
  const target = event.target as HTMLElement;
  const stop = (href: string) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(href);
  };
  const internal = internalLink(target);
  if (internal && plainClick(event)) return stop(internal);
  const shortcut = target.closest<HTMLElement>('#app [data-destination]');
  const destination = footerDestination(shortcut?.dataset.destination, data.site.sample);
  if (destination && plainClick(event)) return stop(destination);
  const link = target.closest<HTMLAnchorElement>('a[href^="#"]');
  if (link && !data.site.sample && /^#(?:signin|signup)$/.test(link.hash)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (crm) location.assign(link.hash === '#signup' ? crm.replace(/\/$/, '') + '/#/sign-up' : crm);
    else navigate('/professionals');
  }
  const contact = target.closest<HTMLElement>('[data-public-contact], [data-company-contact]');
  if (contact && !data.site.sample) {
    const kind = contact.hasAttribute('data-company-contact') ? 'company' : 'agent';
    const number = Number(contact.dataset.companyContact ?? contact.dataset.publicContact);
    const list = kind === 'company' ? data.catalogue.companies : data.catalogue.agents;
    const item = list.find((p) => alias(data, kind, p.id) === number);
    if (item) stop('/enquiry?' + kind + '=' + encodeURIComponent(item.id));
    return;
  }
  const enquiry = target.closest<HTMLElement>('[data-enquiry], [data-whatsapp]');
  if (enquiry && !data.site.sample) {
    const number = Number(enquiry.dataset.id || enquiry.dataset.whatsapp);
    const property = data.catalogue.listings.find((p) => alias(data, 'property', p.id) === number);
    if (property) stop('/enquiry?listing=' + encodeURIComponent(property.id));
  }
}
