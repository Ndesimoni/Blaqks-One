import { publicDetails } from './reference-public-details.js';
import { publicPagination } from './reference-pagination.js';
import { homeDevelopers } from './reference-developers.js';
import { liveText } from './reference-live-text.js';

// Return focus to the community/developer search after its results re-render.
function restoreDirectorySearch() {
  const typed = document.body.dataset.placeSearch;
  delete document.body.dataset.placeSearch;
  const input = document.querySelector('#u-place-search');
  if (typed === undefined || !input) return;
  queueMicrotask(() => {
    input.focus();
    const changed = input.value.trim() !== typed.trim();
    input.value = typed;
    if (changed) input.dispatchEvent(new Event('input', { bubbles: true }));
    input.setSelectionRange(input.value.length, input.value.length);
  });
}

export function afterRender() {
  const data = window.__blaqksReference;
  if (!data) return;
  restoreDirectorySearch();
  if (!data.site.sample && data.page === 'enquiry') {
    const form = document.querySelector('#public-contact-form');
    if (form && !document.querySelector('#reference-enquiry')) {
      const node = document.createElement('div');
      node.id = 'reference-enquiry';
      node.className = 'u-contact-form';
      form.replaceWith(node);
    }
  }
  if (data.site.sample) {
    homeDevelopers(data);
    return;
  }
  document.querySelector('.preview-control')?.remove();
  publicPagination(data);
  publicDetails(data);
  document.querySelector('.d-spotlight')?.remove();
  const property = data.entity && 'title' in data.entity ? data.entity : null;
  document.querySelectorAll('.p-gallery img').forEach((img, index) => {
    if (property) img.src = property.photos[index] || property.image;
  });
  const description = document.querySelector('#overview > p:not(.e-kicker):not(.p-small)');
  if (description && property) description.textContent = property.description;
  // Profile-photo badges only ever said SAMPLE PROFILE; connected profiles need no badge.
  document.querySelectorAll('.u-sample').forEach((node) => node.remove());
  document.querySelectorAll('.u-note, .p-gallery-note, .u-compact-note').forEach((node) => {
    node.textContent = 'Public information published by the listing company.';
  });
  liveText();
  homeDevelopers(data);
}
