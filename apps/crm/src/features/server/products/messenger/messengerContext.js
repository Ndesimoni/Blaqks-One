import { createContext, useContext } from 'react';

/**
 * Opens the slide-in messenger (NAV3) from anywhere in the connected shell: `(box, id)` with
 * box `inbox` or `team` and, optionally, the conversation to show. Null outside the shell.
 */
export const MessengerContext = createContext(null);

export const useOpenMessenger = () => useContext(MessengerContext);
