let cleanUpMap = () => {};

export function bindPropertyLocation() {
  cleanUpMap();
  cleanUpMap = () => {};
  const map = document.querySelector('[data-area-map]');
  if (!map) return;
  const stage = map.querySelector('.community-map-stage');
  const status = map.querySelector('[data-map-status]');
  const button = map.querySelector('[data-map-load]');
  let observer;
  let timer;
  let frame;
  let disposed = false;
  const clearFrame = () => {
    clearTimeout(timer);
    if (frame) frame.onload = frame.onerror = null;
  };
  const retry = (message) => {
    status.textContent = message;
    button.textContent = 'Retry map';
    button.removeAttribute('aria-disabled');
  };
  const load = () => {
    if (disposed || !map.isConnected || button.getAttribute('aria-disabled') === 'true') return;
    observer?.disconnect();
    clearFrame();
    frame?.remove();
    frame = document.createElement('iframe');
    frame.title = map.dataset.mapTitle;
    frame.referrerPolicy = 'no-referrer';
    frame.loading = 'lazy';
    frame.src = map.dataset.mapSrc;
    frame.onload = () => {
      clearTimeout(timer);
      status.textContent = 'If the map does not appear, open the community map below.';
      button.textContent = 'Reload map';
      button.removeAttribute('aria-disabled');
    };
    frame.onerror = () => {
      clearTimeout(timer);
      frame.remove();
      retry('The map could not load. Retry or open the community map below.');
    };
    button.setAttribute('aria-disabled', 'true');
    button.textContent = 'Loading map…';
    status.textContent = 'Loading the community map from OpenStreetMap…';
    stage.append(frame);
    timer = setTimeout(() => {
      retry('The map is taking longer than expected. Retry or open the community map below.');
    }, 10000);
  };
  button.onclick = load;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load();
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(map);
  } else {
    status.textContent = 'Load the community map when you are ready, or open it in a new tab.';
  }
  cleanUpMap = () => {
    disposed = true;
    observer?.disconnect();
    clearFrame();
    button.onclick = null;
  };
}
