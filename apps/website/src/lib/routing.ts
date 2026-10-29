const directories: Record<string, string> = {
  properties: 'property',
  companies: 'company',
  agents: 'agent',
  developers: 'developer',
  areas: 'area',
};
export function websiteRoute(path: string[] = []): { page: string; id?: string } | null {
  if (!path.length) return { page: 'home' };
  if (
    path.length === 1 &&
    [
      'properties',
      'companies',
      'agents',
      'developers',
      'areas',
      'about',
      'contact',
      'enquiry',
      'privacy',
      'terms',
    ].includes(path[0])
  )
    return { page: path[0] };
  if (
    path.length === 2 &&
    Object.hasOwn(directories, path[0]) &&
    /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(path[1])
  )
    return { page: directories[path[0]], id: path[1] };
  return null;
}
