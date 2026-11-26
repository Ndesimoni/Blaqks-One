const observer = new ResizeObserver(([entry]) => {
  document.body.style.setProperty('--preview-height', `${entry.target.offsetHeight}px`);
});

export function toggleDisclosure(button, force) {
  const target = document.getElementById(button.getAttribute('aria-controls'));
  const open = force ?? !target.classList.contains('open');
  target.classList.toggle('open', open);
  button.setAttribute('aria-expanded', String(open));
  return open;
}

export function bindNavigation() {
  observer.disconnect();
  const bar = document.querySelector('.review-bar');
  if (bar) observer.observe(bar);
  document.onkeydown = (event) => {
    if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    const buttons = [...document.querySelectorAll('[data-action="menu"], [data-action="filters"]')];
    const open = buttons.find((button) => button.getAttribute('aria-expanded') === 'true');
    if (!open) return;
    event.preventDefault();
    toggleDisclosure(open, false);
    open.focus();
  };
}
