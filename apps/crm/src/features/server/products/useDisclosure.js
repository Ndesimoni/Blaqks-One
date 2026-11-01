import { useEffect, useRef, useState } from 'react';

/**
 * A top-bar popover's open state (NAV): a click outside closes it, and Escape closes it and
 * returns focus to the button that opened it. `root` wraps the button and the popover.
 */
export function useDisclosure() {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const opener = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => !root.current?.contains(event.target) && setOpen(false);
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      opener.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return { open, setOpen, root, opener };
}
