/**
 * Field guidance visibility (packet Q1). A pinned hint stays open until the member types
 * or closes it; automatic hints need the preference on, an untouched field and focus.
 */
export const hintVisible = ({ enabled, focused, pinned, typed }) =>
  Boolean(pinned || (enabled && focused && !typed));

/**
 * Whether focusing `control` may open its hint automatically. A dropdown opened with the
 * mouse must not change while the browser opens its list: Chrome on Mac then closes the
 * list and the first choice is lost. Keyboard focus (`:focus-visible`) still shows it.
 */
export function focusOpensHint(control) {
  if (control?.tagName !== 'SELECT') return true;
  try {
    return control.matches(':focus-visible');
  } catch {
    return false;
  }
}
