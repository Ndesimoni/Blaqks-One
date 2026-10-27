import { bindForms, saveEditorValues } from './form-interactions.js';
import { url } from './helpers.js';
export function bindInteractions(ctx, state, render) {
  document.querySelector('.skip').onclick = (e) => {
    e.preventDefault();
    document.querySelector('#main').focus();
  };
  document.querySelectorAll('[data-anchor]').forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        document.getElementById(a.dataset.anchor)?.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        });
      }),
  );
  document.querySelectorAll('[data-action]').forEach((el) => {
    const action = el.dataset.action;
    if (action === 'sort') {
      el.onchange = () => {
        const q = Object.fromEntries(ctx.query);
        location.hash = url('properties', { ...q, sort: el.value, page: '1' });
      };
      return;
    }
    el.onclick = () => {
      if (action === 'menu' || action === 'filters') {
        const target =
          action === 'menu'
            ? document.getElementById('nav')
            : document.getElementById('filter-panel');
        const open = target.classList.toggle('open');
        el.setAttribute('aria-expanded', String(open));
        return;
      }
      if (action === 'gallery') {
        const d = document.getElementById('gallery');
        d.querySelector('img').src = el.dataset.image;
        d.showModal();
        return;
      }
      if (action === 'close-gallery') {
        document.getElementById('gallery').close();
        return;
      }
      if (action === 'back') {
        history.back();
        return;
      }
      if (action === 'domain') {
        location.hash = url('editor', {
          ...Object.fromEntries(ctx.query),
          section: 'settings',
          domain: 'active',
        });
        return;
      }
      if (action === 'submit-review') {
        state.draft = 'submitted';
        saveEditorValues(state);
        render();
        return;
      }
      if (action === 'review') {
        state.review = el.dataset.value;
        render();
      }
    };
  });
  bindForms(ctx, state);
  const editorForm = document.querySelector('[data-form="editor"]');
  if (editorForm)
    editorForm.querySelectorAll('[name="theme"]').forEach((input) =>
      input.addEventListener('change', () => {
        saveEditorValues(state);
        location.hash = url('editor', {
          section: ctx.query.get('section') || 'design',
          theme: input.value,
        });
      }),
    );
  document.querySelectorAll('a[href^="#/"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      if (
        editorForm?.dataset.dirty === 'true' &&
        !state.saved &&
        !confirm('Leave this unsaved design draft?')
      )
        e.preventDefault();
    }),
  );
}
