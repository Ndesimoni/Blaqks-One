export function referenceJSON(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}
