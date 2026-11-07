import fs from 'node:fs/promises';

// Fails the build when an approved-source string moves, instead of silently skipping a fix.
const exact = (source, from, to) => {
  if (!source.includes(from)) throw Error('Approved source patch target is missing: ' + from);
  return source.replace(from, () => to);
};

export async function patchReference(root) {
  const patch = async (file, transform) => {
    const path = root + '/' + file;
    await fs.writeFile(path, transform(await fs.readFile(path, 'utf8')));
  };
  for (const file of await fs.readdir(root)) {
    if (!file.endsWith('.js')) continue;
    await patch(file, (s) => s.replaceAll('assets/', '/approved/assets/'));
  }
  await patch('estate.js', (s) => s.replace('export const homes=[', 'export const homes=['));
  await patch('estate.js', (s) =>
    s.replaceAll(
      'src="/approved/assets/${p.img}.jpg"',
      'src="${p.imageURL || `/approved/assets/${p.img}.jpg`}"',
    ),
  );
  await patch('public-pages.js', (s) =>
    s.replaceAll(
      'src="/approved/assets/${c.img}.jpg"',
      'src="${c.imageURL || `/approved/assets/${c.img}.jpg`}"',
    ),
  );
  await patch('property.js', (s) =>
    s.replaceAll(
      'src="/approved/assets/${p.img}.jpg"',
      'src="${p.imageURL || `/approved/assets/${p.img}.jpg`}"',
    ),
  );
  await patch('deal-cards.js', (s) =>
    s.replaceAll(
      'src="/approved/assets/${p.img}.jpg"',
      'src="${p.imageURL || `/approved/assets/${p.img}.jpg`}"',
    ),
  );
  await patch(
    'property-metadata.js',
    (s) =>
      s.replace('export const metaFor=p=>({', 'const originalMeta=p=>({') +
      '\nexport const metaFor=p=>p.publicMeta || originalMeta(p);\n',
  );
  await patch(
    'property.js',
    (s) =>
      s.replace('export const galleryFor=p=>[', 'const sampleGallery=p=>[') +
      '\nexport const galleryFor=p=>p.photos?.length?p.photos.map((url,i)=>({url,src:"villa",label:"Property photo "+(i+1)})):sampleGallery(p);\n',
  );
  await patch('property-actions.js', (s) =>
    s
      .replaceAll(
        'src="/approved/assets/${photo.src}.jpg"',
        'src="${photo.url || `/approved/assets/${photo.src}.jpg`}"',
      )
      .replaceAll(
        '+4)%4',
        '+galleryFor(propertyById(photoProperty)).length)%galleryFor(propertyById(photoProperty)).length',
      ),
  );
  await patch('property-state.js', (s) =>
    s.replaceAll(
      "'blaqks:'+key",
      "'blaqks:'+ (window.__blaqksReference?.site.id || 'preview') + ':' +key",
    ),
  );
  await patch('app.js', (s) => "import { extraPage } from './reference-extra.js';\n" + s);
  await patch('app.js', (s) =>
    s.replace(
      'if (route === "home") app.innerHTML',
      'if (["privacy","terms","developers","areas","developer","area"].includes(route)) app.innerHTML=extraPage(); else if (route === "home") app.innerHTML',
    ),
  );
  // Next remounts #app/#overlay on navigation, so render() re-queries them every time.
  await patch('app.js', (s) =>
    [
      ['const app = document.querySelector("#app"),', 'let app = document.querySelector("#app"),'],
      [
        'function render() {',
        'export function render() {\n  app = document.querySelector("#app");\n  overlay = document.querySelector("#overlay");',
      ],
      [
        'document.body.classList.toggle("estate-page", ',
        'document.body.classList.toggle("estate-page", ["privacy","terms","developers","areas","developer","area"].includes(route) || ',
      ],
    ].reduce((text, [from, to]) => exact(text, from, to), s),
  );
  await patch('property-extras.js', (s) =>
    [
      [
        'Featured properties</a>',
        'Featured properties</a><a href="/areas">Communities</a><a href="/developers">Developers</a>',
      ],
      [
        '<button data-legal="Privacy">Privacy policy</button>',
        '<a href="/privacy">Privacy policy</a>',
      ],
      [
        '<button data-legal="Terms">Terms & conditions</button>',
        '<a href="/terms">Terms & conditions</a>',
      ],
    ].reduce((text, [from, to]) => exact(text, from, to), s),
  );
  // The saved/recent/compare tabs had no current-page state.
  await patch('property-journey.js', (s) =>
    exact(
      s,
      '<a href="#saved">Saved properties</a><a href="#recent">Recently viewed</a><a href="#compare">Compare properties</a>',
      '${[["saved","Saved properties"],["recent","Recently viewed"],["compare","Compare properties"]].map(([r,l])=>`<a href="#${r}"${r===route?\' aria-current="page"\':""}>${l}</a>`).join("")}',
    ),
  );
  await patch('app.js', (s) =>
    s.replace(
      'setupJourney({toast});',
      'window.addEventListener("blaqks:render", render);\nsetupJourney({toast});',
    ),
  );
  await patch('app.js', (s) =>
    s.replace(
      'window.scrollTo(0, 0);',
      'window.scrollTo(0, 0);\n  document.dispatchEvent(new CustomEvent("blaqks:rendered"));',
    ),
  );
  await patch('properties-actions.js', (s) =>
    s.replace("history.replaceState(null,'',url)", "history.replaceState(history.state,'',url)"),
  );
}
