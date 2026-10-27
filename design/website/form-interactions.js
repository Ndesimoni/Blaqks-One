import { url } from './helpers.js';
export function bindForms(ctx, state) {
  document.querySelectorAll('form[data-form]').forEach((form) => {
    const kind = form.dataset.form;
    if (kind === 'editor') restoreEditorValues(form, state);
    form.onsubmit = (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      if (['search', 'filters'].includes(kind)) {
        location.hash = url('properties', clean(data));
        return;
      }
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
    if (kind === 'filters')
      form.addEventListener('change', (event) => {
        if (event.target.name !== 'purpose') return;
        const purpose = event.target.value;
        form.elements.budget.value = '';
        form.elements.budget.disabled = !purpose;
        form.querySelector('[data-budget-label]').textContent =
          `Maximum ${purpose === 'rent' ? 'annual rent' : purpose === 'holiday' ? 'nightly rate' : 'sale price'} (AED)`;
      });
    if (kind === 'search')
      form.addEventListener('change', (e) => {
        if (e.target.name !== 'purpose') return;
        const purpose = e.target.value,
          budget = form.elements.budget;
        const values =
          purpose === 'buy'
            ? [
                [3000000, '3 million'],
                [5000000, '5 million'],
              ]
            : purpose === 'rent'
              ? [
                  [150000, '150,000 / year'],
                  [250000, '250,000 / year'],
                ]
              : [
                  [1000, '1,000 / night'],
                  [1500, '1,500 / night'],
                ];
        budget.innerHTML =
          '<option value="">Any budget</option>' +
          values.map(([v, t]) => `<option value="${v}">Up to AED ${t}</option>`).join('');
        budget.nextElementSibling.textContent =
          purpose === 'buy'
            ? 'Sale price'
            : purpose === 'rent'
              ? 'Annual rental price'
              : 'Nightly price';
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
