import type { Metadata } from 'next';
import { loadPage } from '@/lib/load-page';
import type { Query } from '@/lib/types';
import WebsitePage from '@/components/WebsitePage';

type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<Query> };

async function dataFor(props: Props) {
  const [params, query] = await Promise.all([props.params, props.searchParams]);
  return loadPage((params.path || []).join('/'), JSON.stringify(query));
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const data = await dataFor(props);
  const entity = data.entity;
  const name = entity && ('title' in entity ? entity.title : entity.name);
  const content = data.site.content;
  return {
    title: `${name || (data.page === 'home' ? content?.seoTitle || 'Find your next place' : data.page.charAt(0).toUpperCase() + data.page.slice(1))} | ${data.site.name}`,
    robots: data.site.sample ? { index: false, follow: false } : undefined,
    description:
      entity && 'description' in entity
        ? entity.description.slice(0, 160)
        : content?.seoDescription ||
          `Explore properties and professional profiles with ${data.site.name}.`,
  };
}
export default async function Page(props: Props) {
  const data = await dataFor(props);
  return <WebsitePage {...data} />;
}
