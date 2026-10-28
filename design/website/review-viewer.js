const frames = JSON.parse(document.getElementById('review-frames').textContent);
let selected = 0,
  width = 1440;
const choose = document.getElementById('page'),
  preview = document.getElementById('preview');
function show() {
  const frame = frames[selected];
  choose.value = String(selected);
  preview.src = frame.images[width];
  preview.alt = frame.title + ' — full ' + (width === 1440 ? 'desktop' : 'mobile') + ' design';
  preview.closest('figure').style.maxWidth = width + 'px';
  document.getElementById('title').textContent = frame.title;
  document.getElementById('status').textContent =
    selected + 1 + ' of ' + frames.length + ' · ' + width + 'px';
  document.getElementById('desktop').setAttribute('aria-pressed', String(width === 1440));
  document.getElementById('mobile').setAttribute('aria-pressed', String(width === 390));
  document.getElementById('previous').disabled = selected === 0;
  document.getElementById('next').disabled = selected === frames.length - 1;
}
choose.onchange = () => {
  selected = Number(choose.value);
  show();
  window.scrollTo(0, 0);
};
document.getElementById('desktop').onclick = () => {
  width = 1440;
  show();
};
document.getElementById('mobile').onclick = () => {
  width = 390;
  show();
};
document.getElementById('previous').onclick = () => {
  selected--;
  show();
  window.scrollTo(0, 0);
};
document.getElementById('next').onclick = () => {
  selected++;
  show();
  window.scrollTo(0, 0);
};
show();
