import { url } from './helpers.js';
import { bindPropertyFilters } from './property-filter-interactions.js';
export function bindForms(ctx, state) {
  document.querySelectorAll('form[data-form]').forEach((form) => {
    const kind = form.dataset.form;
    if (['search', 'filters'].includes(kind)) {
      bindPropertyFilters(form, ctx);
      return;
    }
    if (kind === 'editor') restoreEditorValues(form, state);
    form.onsubmit = (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      if (kind === 'directory') {
        const { destination, ...q } = data;
        location.hash = url(destination, clean(q));
        return;
      }
      if (kind === 'enquiry') {
        const error = form.querySelector('.form-error');
        if (!data.email.trim() && !data.phone.trim()) {
          error.textContent = 'Add an email or phone number for a reply.';
          form.elements.email.focus();
          return;
        }
        if (data.preference === 'email' && !data.email.trim()) {
          error.textContent = 'Add an email or choose Phone as your preferred response.';
          form.elements.email.focus();
          return;
        }
        if (data.preference === 'phone' && !data.phone.trim()) {
          error.textContent = 'Add a phone number or choose Email as your preferred response.';
          form.elements.phone.focus();
          return;
        }
        location.hash = url(
          'enquiry',
          clean({ listing: data.listing, company: data.company, agent: data.agent, receipt: '1' }),
          ctx.scope,
        );
        return;
      }
      if (kind === 'editor') {
        saveEditorValues(state);
        state.saved = true;
        const status = document.getElementById('save-status');
        status.textContent = 'Draft saved in this open design preview only. Nothing published.';
        form.dataset.dirty = 'false';
      }
    };
    if (kind === 'editor')
      form.addEventListener('input', () => {
        form.dataset.dirty = 'true';
        state.saved = false;
      });
  });
}
const clean = (data) => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== ''));
export function saveEditorValues(state) {
  const form = document.querySelector('[data-form="editor"]');
  if (form) Object.assign(state.draftValues, Object.fromEntries(new FormData(form)));
}
function restoreEditorValues(form, state) {
  for (const [name, value] of Object.entries(state.draftValues)) {
    const control = form.elements.namedItem(name);
    if (!control) continue;
    if (control instanceof RadioNodeList) control.value = value;
    else if (control.type === 'checkbox') control.checked = Boolean(value);
    else control.value = value;
  }
}
