import { areas, properties } from './data.js';
export const areasFor = (scope = {}, emirate = '') =>
  areas.filter(
    (area) =>
      (!emirate || area.emirate === emirate) &&
      (!scope.site || properties.some((p) => p.company === scope.site && p.area === area.id)),
  );
