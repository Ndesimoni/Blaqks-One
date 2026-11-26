import { expect } from '@playwright/test';

/**
 * WCAG contrast of an element's text against its composited background. Colours are resolved
 * through a canvas so any CSS colour syntax (oklch, color-mix) is measured as rendered sRGB.
 */
export function contrast(locator) {
  return locator.evaluate((element) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const paint = (layers) => {
      context.clearRect(0, 0, 1, 1);
      for (const colour of layers) {
        context.fillStyle = colour;
        context.fillRect(0, 0, 1, 1);
      }
      return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    // Every ancestor background, painted root first, so translucent layers composite correctly.
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const background = getComputedStyle(node).backgroundColor;
      if (background && background !== 'rgba(0, 0, 0, 0)') layers.unshift(background);
    }
    const back = paint(['#fff', ...layers]);
    const fore = paint(['#fff', ...layers, getComputedStyle(element).color]);
    const lum = (rgb) =>
      rgb
        .map((value) => value / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, index) => sum + v * [0.2126, 0.7152, 0.0722][index], 0);
    const [a, b] = [lum(fore), lum(back)].sort((x, y) => y - x);
    return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
  });
}

/** Asserts readable text contrast (WCAG 1.4.3 AA, 4.5:1 for small text). */
export async function readable(locator, label) {
  const ratio = await contrast(locator);
  expect(ratio, `${label} contrast ${ratio}`).toBeGreaterThanOrEqual(4.5);
  return ratio;
}

/** Every control box is at least 44px tall (design standards: comfortable touch targets). */
export async function tallTargets(locator, label) {
  for (const box of await locator.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().height),
  ))
    expect(box, `${label} target height`).toBeGreaterThanOrEqual(44);
}

/** The focused element shows a visible focus indicator. */
export async function focusVisible(page) {
  const ring = await page.evaluate(() => {
    const element = document.activeElement;
    const style = getComputedStyle(element);
    return {
      visible: element.matches(':focus-visible'),
      outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0,
      shadow: style.boxShadow !== 'none',
    };
  });
  expect(ring.visible).toBe(true);
  expect(ring.outline || ring.shadow, JSON.stringify(ring)).toBe(true);
}
