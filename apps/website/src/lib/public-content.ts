const keys = [
  'tagline',
  'about',
  'services',
  'contactText',
  'heroTitle',
  'heroSubtitle',
  'seoTitle',
  'seoDescription',
];
export function publicContent(value: unknown): Record<string, string> {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid public content.');
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => keys.includes(key))
      .map(([key, text]) => {
        if (typeof text !== 'string' || text.length > 16000) throw Error('Invalid public content.');
        return [key, text];
      }),
  );
}
