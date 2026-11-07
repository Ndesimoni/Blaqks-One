import { bind } from './reference-binding.js';
import { afterRender } from './reference-after-render.js';
import { motionAfterRender, motionBeforeRender } from './reference-motion.js';

let ready;
async function mount(data) {
  // The engine renders when it is first imported and again on blaqks:render; both continue
  // the hero entrance already on screen.
  motionBeforeRender();
  bind(data);
  if (!ready) ready = import('./app.js');
  await ready;
  motionBeforeRender();
  window.dispatchEvent(new Event('blaqks:render'));
}

document.addEventListener('blaqks:rendered', afterRender);
// After the integration fixes, so the reveal also sees the added developer tiles.
document.addEventListener('blaqks:rendered', motionAfterRender);
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
