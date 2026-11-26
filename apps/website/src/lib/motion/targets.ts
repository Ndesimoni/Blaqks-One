// Blocks that fade up as they arrive: section heads, text blocks, cards and image/story blocks.
// Wrappers that paint full-width bands (Harbour's services and ending) are never targets; their
// contents are. Sticky panels, headers, footers and the preview labels are left out on purpose.

const company = [
  // Theme 1 (Harbour atelier); theme 2 reuses these classes on its inner pages.
  '.a-section-head',
  '.a-card',
  '.a-person',
  '.a-service-grid > *',
  '.a-story > *',
  '.a-home-faq-grid > *',
  '.a-closing > *',
  '.a-faq > *',
  '.a-values > *',
  // Theme 2 (Modern) homepage.
  '.v-section-title',
  '.v-property-card',
  '.v-view-all',
  '.v-trust > *',
  '.v-lifestyle-grid > *',
  '.v-benefit-grid > *',
  '.v-about > *',
  '.v-advisor-heading',
  '.v-advisor-grid > *',
  '.v-contact-layout > *',
  // Themes 3 and 4, and the shared directory, profile and property pages.
  '.section-heading',
  '.property-card',
  '.person-card',
  '.area-card',
  '.developer-card',
  '.developer-strip > a',
  '.editorial-block > *',
  '.closing-section > *',
  '.values-grid > *',
  '.detail-section',
];

const platform = [
  '.e-benefits > article',
  '.e-section-head',
  '.e-section > :is(.e-kicker, h2)',
  '.e-results',
  '.e-card',
  '.e-why > *',
  '.d-home-links > a',
  '.d-card',
  '.e-brokers > *',
  '.e-news',
  '.u-compact-agent',
  '.e-partner',
  '.u-directory-grid > *',
  '.u-fact-grid > *',
  '.u-story > *',
  '.u-values > *',
  '.u-cta',
  '.u-help-contact',
  '.u-faq',
  '.p-section',
  '.p-listed-by',
  '.d-spotlight > *',
  '.d-explained > *',
];

export const companyTargets = company.join(', ');
export const platformTargets = platform.join(', ');
