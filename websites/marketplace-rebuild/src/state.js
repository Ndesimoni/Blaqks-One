const memory = {};
export function read(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem('blaqks-marketplace:' + key));
    return value ?? memory[key] ?? fallback;
  } catch {
    return memory[key] ?? fallback;
  }
}

export function write(key, value) {
  memory[key] = value;
  try {
    localStorage.setItem('blaqks-marketplace:' + key, JSON.stringify(value));
  } catch {
    // Keep this visit usable when browser storage is blocked.
  }
}

export const ids = key => {
  const value = read(key);
  return Array.isArray(value) ? value.filter(Number.isInteger) : [];
};

export function toggleSaved(id) {
  const saved = ids('saved');
  write('saved', saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id]);
}

export function remember(id) {
  write('recent', [id, ...ids('recent').filter(x => x !== id)].slice(0, 8));
}

export function compareSelection(id, properties) {
  const selected = ids('compare');
  if (selected.includes(id)) {
    write('compare', selected.filter(x => x !== id));
    return '';
  }
  if (selected.length >= 3) return 'Compare up to three properties. Remove one first.';
  const item = properties.find(p => p.id === id);
  const first = properties.find(p => p.id === selected[0]);
  if (!item) return 'Property not found.';
  if (first && first.purpose !== item.purpose) {
    return 'Compare sale prices and annual rents separately.';
  }
  write('compare', [...selected, id]);
  return '';
}

export function filterProperties(items, params) {
  const value = name => params.get(name) || '';
  const purpose = value('purpose');
  const query = value('q').toLowerCase();
  const list = items.filter(p =>
    (!purpose || p.purpose === purpose) &&
    (!query || (p.title + ' ' + p.area + ' ' + p.type).toLowerCase().includes(query)) &&
    (!value('area') || p.area === value('area')) &&
    (!value('type') || p.type === value('type')) &&
    (!value('beds') || p.type !== 'Office' &&
      (value('beds') === '5' ? p.beds >= 5 : p.beds === Number(value('beds')))) &&
    (!value('baths') || p.baths >= Number(value('baths'))) &&
    (!purpose || !value('min') || p.price >= Number(value('min'))) &&
    (!purpose || !value('max') || p.price <= Number(value('max'))) &&
    (!value('sizeMin') || p.size >= Number(value('sizeMin'))) &&
    (!value('sizeMax') || p.size <= Number(value('sizeMax'))) &&
    (!value('furnishing') || p.furnishing === value('furnishing')) &&
    (!value('completion') || p.completion === value('completion')) &&
    (!value('status') || p.status === value('status')) &&
    (!value('company') || p.company === Number(value('company'))) &&
    (!value('deal') || p.deal === value('deal')) &&
    params.getAll('amenity').every(a => p.amenities.includes(a))
  );
  return list.sort((a, b) => {
    if (purpose && value('sort') === 'price-asc') return a.price - b.price;
    if (purpose && value('sort') === 'price-desc') return b.price - a.price;
    if (value('sort') === 'size') return b.size - a.size;
    return a.id - b.id;
  });
}
