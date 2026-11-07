export function referenceIdentity(kind: string, id: string, sample: boolean): number {
  if (sample && /^\d+$/.test(id)) return Number(id);
  let value = 2166136261;
  for (const character of kind + ':' + id) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0 || 1;
}
