/**
 * Pure rules behind `npm run check:boundaries` (docs/service-boundaries.md, rule 12).
 * A module is the first directory under services/crm-api/src, or `root` for files
 * directly in it. Names are `crm_*` tables, views, functions and constraints. Shared
 * infrastructure (rule 5) must also name no business-domain module path.
 */

const namePattern = /\bcrm_[a-z_]+/g;

/** Drops `//` comments when the text before them holds an even number of quotes. */
export function stripComment(line) {
  let from = 0;
  for (;;) {
    const index = line.indexOf('//', from);
    if (index === -1) return line;
    const quotes = (line.slice(0, index).replace(/\\"/g, '').match(/"/g) || []).length;
    if (quotes % 2 === 0) return line.slice(0, index);
    from = index + 2;
  }
}

/** `{name, line}` for every match of `pattern` (global) outside comments. */
export function namesIn(text, pattern = namePattern) {
  const found = [];
  text.split('\n').forEach((raw, index) => {
    for (const [name] of stripComment(raw).matchAll(pattern)) {
      found.push({ name, line: index + 1 });
    }
  });
  return found;
}

/** Module paths such as `records::` named by a domain-free file, as violations. */
function domainImports(map, path, text) {
  const { paths, domains } = map.domainFree;
  if (!paths.some((prefix) => path === prefix || path.startsWith(prefix))) return [];
  const pattern = new RegExp(`\\b(?:${domains.join('|')})::`, 'g');
  return namesIn(text, pattern).map(
    ({ name, line }) =>
      `${path}:${line} shared infrastructure names the domain path ${name} (rule 5).`,
  );
}

/** The module of a path relative to the crate's `src/` directory. */
export function moduleOf(relativePath) {
  const parts = relativePath.split(/[\\/]/);
  return parts.length > 1 ? parts[0] : 'root';
}

/** Name → owning modules, rejecting a name listed twice for one module. */
export function ownersByName(owners) {
  const byName = new Map();
  for (const [module, names] of Object.entries(owners)) {
    for (const name of names) {
      const list = byName.get(name) || [];
      if (list.includes(module)) throw Error(`${name} is listed twice for ${module}.`);
      byName.set(name, [...list, module]);
    }
  }
  return byName;
}

/**
 * Checks `files` ({path, text}, path relative to src/) against the map. Returns
 * `violations` (unowned names and unlisted cross-module access) and `stale` allowlist
 * entries that no file uses any more, so the allowlist only shrinks.
 */
export function checkBoundaries(map, files) {
  const owners = ownersByName(map.owners);
  const published = new Set(map.published);
  const unrestricted = new Set(Object.keys(map.unrestricted));
  const used = new Set();
  const violations = [];
  for (const { path, text } of files) {
    const module = moduleOf(path);
    violations.push(...domainImports(map, path, text));
    for (const { name, line } of namesIn(text)) {
      const where = `${path}:${line}`;
      const owning = owners.get(name);
      if (!owning) {
        violations.push(`${where} ${name} has no owner in the boundary map.`);
        continue;
      }
      if (owning.includes(module) || published.has(name) || unrestricted.has(module)) continue;
      used.add(`${module}→${name}`);
      if (!map.allowed[module]?.[name]) {
        const owner = owning.join(' and ');
        violations.push(`${where} ${module}/ uses ${name} (owned by ${owner}) without an entry.`);
      }
    }
  }
  const stale = Object.entries(map.allowed).flatMap(([module, names]) =>
    Object.keys(names)
      .filter((name) => !used.has(`${module}→${name}`))
      .map((name) => `${module}/ → ${name}`),
  );
  return { violations: [...new Set(violations)], stale };
}
