import { fromSocial, toSocial } from './social/socialModel.js';

/** Public website content only; identity contacts, eligibility and private records stay out. */
export const CONTENT_KEYS = [
  'heroTitle',
  'heroSubtitle',
  'tagline',
  'about',
  'services',
  'contactText',
  'seoTitle',
  'seoDescription',
];
export const THEMES = ['1', '2', '3', '4'];

export function websiteForm(site, platform, draft) {
  const source = draft || site || {};
  return {
    version: source.version ?? 0,
    name: source.name || '',
    theme: source.theme || '1',
    active: source.active ?? true,
    ...(platform ? { host: source.host || '' } : !site ? { slug: source.slug || '' } : {}),
    ...(!platform
      ? {
          company: {
            mark: source.company?.mark || 'CO',
            area: source.company?.area || 'UAE',
            note: source.company?.note || '',
          },
        }
      : {}),
    content: Object.fromEntries(CONTENT_KEYS.map((key) => [key, source.content?.[key] || ''])),
    social: fromSocial(source.content?.social),
  };
}

/** The draft body; social links go inside content, left out entirely when there are none. */
export function websitePayload(form, platform) {
  const social = toSocial(form.social);
  return {
    version: form.version,
    name: form.name.trim(),
    theme: form.theme,
    active: form.active,
    ...(platform
      ? { host: form.host.trim().toLowerCase() }
      : form.slug !== undefined
        ? { slug: form.slug.trim() }
        : {}),
    ...(!platform
      ? {
          company: {
            mark: form.company.mark.trim(),
            area: form.company.area.trim(),
            note: form.company.note.trim() || 'Property advice for your next move.',
          },
        }
      : {}),
    content: {
      ...Object.fromEntries(
        CONTENT_KEYS.map((key) => [key, form.content[key].trim()]).filter(([, value]) => value),
      ),
      ...(social ? { social } : {}),
    },
  };
}

export function websiteStatus(site, platform) {
  if (!site) return 'notPublished';
  if (!site.active) return 'hidden';
  if (!platform && !site.entitled) return 'setupRequired';
  return 'published';
}

export function websiteAccess(user, owner, platform) {
  if (platform) return user?.roleId === 'super-admin';
  return (
    user?.roleId === 'admin' &&
    owner?.status !== 'archived' &&
    owner?.id === (user.workspaceId || user.id)
  );
}

export function websiteApi(api, workspace, platform) {
  return {
    read: (signal) =>
      platform ? api.platformWebsite(signal) : api.companyWebsite(workspace, signal),
    readDraft: (signal) =>
      platform ? api.platformWebsiteDraft(signal) : api.websiteDraft(workspace, signal),
    save: (body) =>
      platform ? api.savePlatformWebsiteDraft(body) : api.saveWebsiteDraft(workspace, body),
    publish: (version) =>
      platform
        ? api.publishPlatformWebsiteDraft(version)
        : api.publishWebsiteDraft(workspace, version),
  };
}
