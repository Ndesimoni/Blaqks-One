import { useEffect, useState } from 'react';

/**
 * Arrow keys, Home, End and Enter for the saved-replies list while focus stays in the
 * search field (a combobox with `aria-activedescendant`); Escape closes only the picker.
 */
export function usePickerKeys(count, onChoose, onClose) {
  const [active, setActive] = useState(-1);
  useEffect(() => setActive((current) => (current >= count ? count - 1 : current)), [count]);
  const onKeyDown = (event) => {
    const move = {
      ArrowDown: (current) => (current + 1) % count,
      ArrowUp: (current) => (current <= 0 ? count - 1 : current - 1),
      Home: () => 0,
      End: () => count - 1,
    }[event.key];
    if (move && count) {
      event.preventDefault();
      setActive(move);
    } else if (event.key === 'Enter') {
      // Never the reply form's own submit: Enter here must not send the message.
      event.preventDefault();
      if (active >= 0) onChoose(active);
    } else if (event.key === 'Escape') {
      // Inside New email the dialog must stay open (designer spec).
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };
  return { active, setActive, onKeyDown };
}
