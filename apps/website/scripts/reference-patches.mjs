import fs from 'node:fs/promises';

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
  await patch('app.js', (s) => s.replace('function render() {', 'export function render() {'));
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
