import type { MetadataRoute } from 'next';
import { products } from '@/lib/products';

const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002').replace(/\/$/, '');

/** Every public page, for search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', '/pricing', '/help', '/contact', ...products.map((p) => `/products/${p.key}`)];
  return paths.map((path) => ({ url: `${base}${path}` }));
}
