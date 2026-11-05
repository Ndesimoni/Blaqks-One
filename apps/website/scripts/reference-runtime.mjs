import { bind, afterRender } from './reference-binding.js';

let ready;
async function mount(data) {
  bind(data);
  if (!ready) ready = import('./app.js');
  await ready;
  window.dispatchEvent(new Event('blaqks:render'));
}

document.addEventListener('blaqks:rendered', afterRender);
window.addEventListener('blaqks:configure', (event) => {
  mount(event.detail).catch(() => {
    const node = document.querySelector('#app');
    if (node) node.textContent = 'The website could not be opened. Please reload to try again.';
  });
});
window.__blaqksReferenceReady = true;
window.dispatchEvent(new Event('blaqks:ready'));

const initial = document.querySelector('#blaqks-reference-data');
if (initial?.textContent) {
  const data = JSON.parse(initial.textContent);
  history.replaceState(
    history.state,
    '',
    location.pathname + location.search + '#' + data.referenceRoute,
  );
  mount(data);
}
