export function publicDetails(data) {
  const p = data.entity && 'title' in data.entity ? data.entity : null;
  if (!p) return;
  const text = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  };
  text('.j-status', 'Published listing');
  text('.p-address', p.emirate + ' · United Arab Emirates');
  text('.p-view-photos', 'View all ' + p.photos.length + ' photos');
  text('.p-contact-note', 'Contact the representative about this published property.');
  text('.p-asking-price + .p-small', 'Published asking price');
  text('#location h2', data.catalogue.areas.find((a) => a.id === p.area)?.name || p.emirate);
  text('#location > p', 'Contact the representative for property location details.');
  document.querySelector('#p-more-copy')?.remove();
  document.querySelector('[data-description]')?.remove();
  const amenities = document.querySelector('.p-amenities');
  if (amenities) {
    amenities.replaceChildren();
    for (const value of p.amenities) {
      const item = document.createElement('div');
      item.textContent = '✓ ' + value;
      amenities.append(item);
    }
  }
  text('#features > .p-small', 'Amenities published by the listing company.');
  document.querySelectorAll('.p-facts dl > div').forEach((node) => {
    const key = node.querySelector('dt')?.textContent;
    const target = node.querySelector('dd');
    if (target && key === 'Listing status') target.textContent = 'Published';
    if (target && key === 'Reference') target.textContent = p.reference;
    if (target && key === 'Purpose') target.textContent = p.purpose;
  });
  const floor = document.querySelector('.j-media-grid article');
  if (floor && p.floorPlans.length) {
    const link = document.createElement('a');
    link.href = p.floorPlans[0];
    link.textContent = 'View published floor plan →';
    floor.querySelector('p').textContent = 'Floor plan supplied by the company.';
    floor.querySelector('button')?.replaceWith(link);
  }
  text('.p-gallery-note', 'Published property photos · Reference ' + p.reference);
}
