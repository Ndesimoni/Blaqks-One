import { canOpenSection } from '../access.js';
import { crmGuides } from './guideCrm.js';
import { crmWorkGuides } from './guideCrmWork.js';
import { noteGuides } from './guideNotes.js';
import { productGuides } from './guideProducts.js';

/**
 * The Guide's articles grouped by topic, as the approved mockup lists them (design queue item
 * 13). A task article shows only to people who can open the section it describes.
 */
export const guides = [...crmGuides, ...crmWorkGuides, ...productGuides, ...noteGuides];

export const topics = ['CRM', 'Websites', 'Marketplace', 'Messages', 'Settings', 'How it works'];

/** Each topic's mark, the product's own icon in the rail. */
export const topicIcons = {
  CRM: 'users',
  Websites: 'monitor',
  Marketplace: 'layers',
  Messages: 'chat',
  Settings: 'sliders',
  'How it works': 'lock',
};

export const visibleGuides = (user) =>
  guides.filter((guide) => !guide.section || canOpenSection(user, guide.section));

const lines = (guide) => guide.steps || guide.points;
const words = (guide) => [guide.title, guide.intro, ...lines(guide)].join(' ').split(/\s+/);

/** Reading time at 200 words a minute, at least one. */
export const readMinutes = (guide) => Math.max(1, Math.round(words(guide).length / 200));

/** The articles in `topic` (null for all) whose text contains every word of `query`. */
export function findGuides(list, topic, query) {
  const needles = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((guide) => {
    if (topic && guide.topic !== topic) return false;
    const text = [...words(guide), ...(guide.path || [])].join(' ').toLowerCase();
    return needles.every((needle) => text.includes(needle));
  });
}

/** `[{ topic, guides }]` in topic order, empty topics left out. */
export const groupGuides = (list) =>
  topics
    .map((topic) => ({ topic, guides: list.filter((guide) => guide.topic === topic) }))
    .filter((group) => group.guides.length);

/** Up to three other articles, the same topic's first. */
export function relatedGuides(list, guide, count = 3) {
  const others = list.filter((other) => other.id !== guide.id);
  const same = others.filter((other) => other.topic === guide.topic);
  return [...same, ...others.filter((other) => other.topic !== guide.topic)].slice(0, count);
}
