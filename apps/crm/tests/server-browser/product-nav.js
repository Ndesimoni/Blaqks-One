import labels from '../../src/i18n/catalogs/en/products.js';
import { productList } from '../../src/features/server/products/productModel.js';

/** The product rail and a product's section sidebar (NAV), as a person finds them. */
export const rail = (page) => page.getByRole('navigation', { name: labels.rail, exact: true });
export const sectionNav = (page, product = 'crm') =>
  page.getByRole('navigation', { name: `${labels[product]} sections`, exact: true });
export const sectionTabs = (page) =>
  page.getByRole('navigation', { name: labels.tabs, exact: true });

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A section button; its name may carry a badge ("Clients, 1 lead shared with you"). */
export const sectionButton = (page, product, label) =>
  sectionNav(page, product).getByRole('button', { name: new RegExp(`^${escape(label)}(,|$)`) });

/** Where a route lives: the first product and section holding it, as the app places it. */
const placesOf = (name) =>
  productList.flatMap((product) =>
    product.sections
      .filter((section) => section.routes.includes(name))
      .map((section) => ({ product: product.key, section })),
  );

/**
 * Opens a route the way a person would: the product on the rail, the section in the
 * sidebar, then the header tab when the section holds several routes. On narrow screens
 * the rail and sidebar live in the navigation drawer.
 */
export async function openPage(page, name, { tabLabel = name } = {}) {
  const places = placesOf(name);
  if (!places.length) throw new Error(`No product holds ${name}`);
  if (!(await rail(page).isVisible()))
    await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  const product = places[0].product;
  const productButton = rail(page).getByRole('button', { name: labels[product], exact: true });
  if ((await productButton.getAttribute('aria-current')) !== 'page') await productButton.click();
  else if (!(await sectionNav(page, product).isVisible())) await productButton.click();
  for (const { section } of places) {
    const button = sectionButton(page, product, labels[`sections.${section.key}`]);
    if (!(await button.count())) continue;
    await button.click();
    // Tabs show only when this person may open more than one route in the section.
    const tab = sectionTabs(page).getByRole('button', { name: tabLabel, exact: true });
    if (section.routes.length > 1 && (await tab.count())) await tab.click();
    return;
  }
  throw new Error(`No visible section holds ${name}`);
}
