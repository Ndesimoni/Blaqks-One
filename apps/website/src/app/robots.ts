import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Keep this development foundation out of search until launch gates are complete.
  return { rules: { userAgent: '*', disallow: '/' } };
}
