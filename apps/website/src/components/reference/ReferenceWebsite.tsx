'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EnquiryForm } from '../EnquiryForm';
import { referenceQuery } from '../../lib/reference/queries';
import { usePublicFilters } from './usePublicFilters';
import { referenceJSON } from '../../lib/reference/serialize';
import { useRouter } from 'next/navigation';
import type { PageData } from '../../lib/types';
import { publicDestination, referenceRoute, alias } from '../../lib/reference/navigation';

type WindowWithReference = Window & {
  __blaqksReferenceReady?: boolean;
  __blaqksReference?: PageData;
};

export function ReferenceWebsite({
  data,
  crm,
  initialHTML,
}: {
  data: PageData;
  crm: string | null;
  initialHTML: string;
}) {
  const router = useRouter();
  usePublicFilters(data);
  const latest = useRef(data);
  const [enquiryTarget, setEnquiryTarget] = useState<HTMLElement | null>(null);
  latest.current = data;
  useEffect(() => {
    const win = window as WindowWithReference;
    const onRendered = () =>
      queueMicrotask(() => {
        setEnquiryTarget(
          latest.current.page === 'enquiry'
            ? document.querySelector<HTMLElement>('#reference-enquiry')
            : null,
        );
      });
    document.addEventListener('blaqks:rendered', onRendered);
    const configure = () => {
      const current = latest.current;
      const route = referenceRoute(current);
      const query = ['properties', 'deals'].includes(route) ? '?' + referenceQuery(current) : '';
      history.replaceState(
        history.state,
        '',
        location.pathname + location.search + '#' + route + query,
      );
      window.dispatchEvent(new CustomEvent('blaqks:configure', { detail: current }));
    };
    const onHash = (event: HashChangeEvent) => {
      const destination = publicDestination(location.hash, latest.current);
      if (!destination) return;
      event.stopImmediatePropagation();
      router.push(destination, { scroll: true });
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest<HTMLAnchorElement>('a[href^="#"]');
      if (link && !latest.current.site.sample && /^#(?:signin|signup)$/.test(link.hash)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (crm)
          location.assign(link.hash === '#signup' ? crm.replace(/\/$/, '') + '/#/sign-up' : crm);
        else router.push('/professionals');
      }
      const contact = target.closest<HTMLElement>('[data-public-contact], [data-company-contact]');
      if (contact && !latest.current.site.sample) {
        const kind = contact.hasAttribute('data-company-contact') ? 'company' : 'agent';
        const number = Number(contact.dataset.companyContact ?? contact.dataset.publicContact);
        const list =
          kind === 'company' ? latest.current.catalogue.companies : latest.current.catalogue.agents;
        const item = list.find((p) => alias(latest.current, kind, p.id) === number);
        if (item) {
          event.preventDefault();
          event.stopImmediatePropagation();
          router.push('/enquiry?' + kind + '=' + encodeURIComponent(item.id));
        }
        return;
      }
      const enquiry = target.closest<HTMLElement>('[data-enquiry], [data-whatsapp]');
      if (enquiry && !latest.current.site.sample) {
        const number = Number(enquiry.dataset.id || enquiry.dataset.whatsapp);
        const property = latest.current.catalogue.listings.find(
          (p) => alias(latest.current, 'property', p.id) === number,
        );
        if (!property) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        router.push('/enquiry?listing=' + encodeURIComponent(property.id));
      }
    };
    window.addEventListener('hashchange', onHash, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('blaqks:ready', configure);
    if (win.__blaqksReferenceReady) configure();
    else if (!document.querySelector('script[data-blaqks-reference]')) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = '/approved/runtime.js';
      script.dataset.blaqksReference = 'true';
      document.body.append(script);
    }
    return () => {
      window.removeEventListener('hashchange', onHash, true);
      window.removeEventListener('blaqks:ready', configure);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('blaqks:rendered', onRendered);
    };
  }, [data, router, crm]);
  return (
    <div className="reference-website">
      <div id="app" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: initialHTML }} />
      <script
        id="blaqks-reference-data"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: referenceJSON({
            ...data,
            referenceRoute:
              referenceRoute(data) +
              (['properties', 'deals'].includes(data.page) ? '?' + referenceQuery(data) : ''),
          }),
        }}
      />
      <script type="module" src="/approved/runtime.js" data-blaqks-reference="true" />
      <div id="overlay" suppressHydrationWarning />
      {enquiryTarget &&
        !data.site.sample &&
        createPortal(
          <EnquiryForm
            listingId={typeof data.query.listing === 'string' ? data.query.listing : undefined}
            agentId={typeof data.query.agent === 'string' ? data.query.agent : undefined}
            companyId={typeof data.query.company === 'string' ? data.query.company : undefined}
          />,
          enquiryTarget,
        )}
      <noscript>
        This interactive website needs JavaScript. Please enable it to browse the collection.
      </noscript>
    </div>
  );
}
