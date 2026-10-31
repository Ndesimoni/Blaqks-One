/**
 * Catalogue rules for `npm run check:i18n` (docs/i18n.md). Pure, so unit tests can feed in
 * small catalogues. `checkCatalogs({ en: { ns: {...} }, ar: {...} })` returns messages;
 * `checkLanguage(catalogs, 'en')` checks one language alone.
 */
const PLACEHOLDER = /\{(\w+)\}/g;
const isPlural = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const placeholders = (value) => {
  const texts = isPlural(value) ? Object.values(value) : [value];
  const names = texts.flatMap((text) =>
    typeof text === 'string' ? [...text.matchAll(PLACEHOLDER)].map((match) => match[1]) : [],
  );
  return [...new Set(names)].sort().join(',');
};

const blank = (text) => typeof text !== 'string' || !text.trim();

/** Problems with one value: empty text or plural forms that do not match the language. */
function valueProblems(language, id, value) {
  if (!isPlural(value)) return blank(value) ? [`${language} ${id} is empty or not text.`] : [];
  const needed = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
  const problems = [];
  for (const category of needed)
    if (blank(value[category])) problems.push(`${language} ${id} needs the "${category}" form.`);
  for (const category of Object.keys(value))
    if (!needed.includes(category))
      problems.push(`${language} ${id} has "${category}", which ${language} does not use.`);
  return problems;
}

function compareNamespace(base, other, namespace, catalogs) {
  const problems = [];
  const left = catalogs[base][namespace];
  const right = catalogs[other][namespace];
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of [...keys].sort()) {
    const id = `${namespace}.${key}`;
    if (!Object.hasOwn(left, key)) problems.push(`${id} is missing in ${base}.`);
    else if (!Object.hasOwn(right, key)) problems.push(`${id} is missing in ${other}.`);
    else {
      if (isPlural(left[key]) !== isPlural(right[key]))
        problems.push(`${id} is plural in only one language.`);
      const [a, b] = [placeholders(left[key]), placeholders(right[key])];
      if (a !== b) problems.push(`${id} placeholders differ: ${base} {${a}} vs ${other} {${b}}.`);
    }
  }
  for (const language of [base, other])
    for (const [key, value] of Object.entries(catalogs[language][namespace]))
      problems.push(...valueProblems(language, `${namespace}.${key}`, value));
  return problems;
}

/** Problems inside one language alone: empty values and plural forms it does not use. */
export function checkLanguage(catalogs, language = 'en') {
  return Object.entries(catalogs[language] ?? {}).flatMap(([namespace, entries]) =>
    Object.entries(entries).flatMap(([key, value]) =>
      valueProblems(language, `${namespace}.${key}`, value),
    ),
  );
}

/** Every difference between `base` (English) and each other language. */
export function checkCatalogs(catalogs, base = 'en') {
  const problems = [];
  for (const other of Object.keys(catalogs).filter((language) => language !== base)) {
    const namespaces = new Set([...Object.keys(catalogs[base]), ...Object.keys(catalogs[other])]);
    for (const namespace of [...namespaces].sort()) {
      if (!catalogs[base][namespace])
        problems.push(`Namespace ${namespace} is missing in ${base}.`);
      else if (!catalogs[other][namespace])
        problems.push(`Namespace ${namespace} is missing in ${other}.`);
      else problems.push(...compareNamespace(base, other, namespace, catalogs));
    }
  }
  return problems;
}

/** Registry problems: every catalogue file is registered, and nothing else is. */
export function checkRegistry(files, registry) {
  const problems = [];
  for (const [language, namespaces] of Object.entries(files)) {
    for (const [namespace, catalog] of Object.entries(namespaces))
      if (registry[language]?.[namespace] !== catalog)
        problems.push(`${language}/${namespace}.js is not registered in catalogs/index.js.`);
    for (const namespace of Object.keys(registry[language] ?? {}))
      if (!namespaces[namespace])
        problems.push(`catalogs/index.js registers ${language}/${namespace} without a file.`);
  }
  for (const language of Object.keys(registry))
    if (!files[language]) problems.push(`catalogs/index.js registers unknown ${language}.`);
  return problems;
}
