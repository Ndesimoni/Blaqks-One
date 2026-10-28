import { url, esc } from './helpers.js';
import { areasFor } from './property-geography.js';
import { types, commercialTypes, priceBasis } from './property-options.js';
import { filterErrors } from './property-filter-validation.js';

export function bindPropertyFilters(form, ctx) {
  const showErrors = (errors) => {
    form.querySelector('.filter-error-summary').textContent = errors
      .map((error) => error.message)
      .join(' ');
    form.querySelectorAll('[aria-invalid]').forEach((node) => node.removeAttribute('aria-invalid'));
    form.querySelectorAll('[data-error-for]').forEach((node) => {
      node.textContent = '';
    });
    for (const error of errors) {
      const field = form.elements.namedItem(error.field);
      if (field instanceof HTMLElement) field.setAttribute('aria-invalid', 'true');
      const hint = form.querySelector(`[data-error-for="${error.field}"]`);
      if (hint) hint.textContent = error.message;
    }
    if (errors.length) {
      form.querySelectorAll('details').forEach((details) => {
        if (details.querySelector('[aria-invalid]')) details.open = true;
      });
      const field = form.elements.namedItem(errors[0].field);
      (field instanceof HTMLElement && !field.disabled && field.type !== 'hidden'
        ? field
        : form.querySelector('.filter-error-summary')
      ).focus();
    }
  };
  const syncPurpose = (reset = false) => {
    const purpose = form.elements.purpose.value;
    for (const name of ['minPrice', 'maxPrice']) {
      form.elements[name].disabled = !purpose;
      if (reset) form.elements[name].value = '';
    }
    if (!purpose && form.elements.sort && form.elements.sort.value.startsWith('price-'))
      form.elements.sort.value = 'newest';
    form.querySelector('[data-price-basis]').textContent = `Budget in AED · ${priceBasis(purpose)}`;
    form.querySelectorAll('[data-purpose]').forEach((group) => {
      group.hidden = group.dataset.purpose !== purpose;
      group.querySelectorAll('input, select').forEach((control) => {
        control.disabled = group.hidden;
        if (group.hidden) control.value = '';
      });
    });
  };
  const syncBedrooms = () => {
    const control = form.elements.bedrooms;
    control.disabled =
      form.elements.category.value === 'commercial' ||
      commercialTypes.includes(form.elements.type.value);
    if (control.disabled) control.value = '';
  };
  form.addEventListener('change', (event) => {
    if (event.target.name === 'purpose') syncPurpose(true);
    if (event.target.name === 'emirate') {
      const selected = form.elements.area.value;
      const choices = areasFor(ctx.scope, event.target.value);
      form.elements.area.innerHTML =
        '<option value="">All communities</option>' +
        choices.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
      if (choices.some((a) => a.id === selected)) form.elements.area.value = selected;
    }
    if (event.target.name === 'category') {
      const current = form.elements.type.value;
      const choices = types.filter(
        (type) =>
          !event.target.value ||
          (commercialTypes.includes(type) ? 'commercial' : 'residential') === event.target.value,
      );
      form.elements.type.innerHTML =
        '<option value="">All property types</option>' +
        choices.map((type) => `<option>${type}</option>`).join('');
      if (choices.includes(current)) form.elements.type.value = current;
    }
    if (['category', 'type'].includes(event.target.name)) syncBedrooms();
  });
  form.addEventListener('reset', () =>
    requestAnimationFrame(() => {
      form.elements.type.innerHTML =
        '<option value="">All property types</option>' +
        types.map((type) => `<option>${type}</option>`).join('');
      form.elements.area.innerHTML =
        '<option value="">All communities</option>' +
        areasFor(ctx.scope)
          .map((a) => `<option value="${a.id}">${esc(a.name)}</option>`)
          .join('');
      syncPurpose(true);
      syncBedrooms();
      showErrors([]);
    }),
  );
  form.onsubmit = (event) => {
    event.preventDefault();
    const source = new FormData(form),
      values = Object.fromEntries(source);
    values.amenities = source.getAll('amenity').join(',');
    delete values.amenity;
    const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value !== ''));
    const errors = filterErrors(query);
    showErrors(errors);
    if (errors.length) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    location.hash = url('properties', Object.fromEntries(query), ctx.scope);
  };
  syncPurpose();
  syncBedrooms();
  if (form.dataset.form === 'filters') showErrors(filterErrors(ctx.query));
}
