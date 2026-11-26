/**
 * Pages that fill the window like messenger apps (owner, 2026-10-22): the conversation takes
 * all the height left, and on phones the bottom bar keeps its hide button inside the bar so it
 * never covers the composer's Send.
 */
export const FULL_HEIGHT_ROUTES = ['Inbox', 'Team chat', 'Marketplace chats'];

export const isFullHeight = (route) => FULL_HEIGHT_ROUTES.includes(route);
