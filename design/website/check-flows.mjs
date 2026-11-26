import { checkDesignRules } from './check-design-rules.mjs';
import { checkContactLinks } from './check-contact.mjs';
import { checkCompanyDesign } from './check-company.mjs';
import { checkDevelopers } from './check-developers.mjs';
import { checkPropertyFilters } from './check-property-filters.mjs';

export async function checkFlows(page, base, root) {
  const darkThemeContrast = await checkDesignRules(page, base);
  const contactLinks = await checkContactLinks(page, base);
  const companyDesign = await checkCompanyDesign(page, base, root);
  const developerChecks = await checkDevelopers(page, base, root);
  const propertyFilters = await checkPropertyFilters(page, base, root);
  return { darkThemeContrast, contactLinks, companyDesign, developerChecks, propertyFilters };
}
