import { useLayoutEffect } from 'react';

/**
 * Grows the message box's text field with what is typed, in every browser (Safari and
 * Firefox lack CSS `field-sizing`): it starts at its CSS minimum, follows the text up to its
 * CSS maximum, then scrolls. Runs after each render, so it also shrinks after sending.
 */
export function useAutoGrow(box) {
  useLayoutEffect(() => {
    const field = box.current?.querySelector('textarea');
    if (!field) return;
    field.style.blockSize = 'auto';
    field.style.blockSize = `${field.scrollHeight}px`;
  });
}
