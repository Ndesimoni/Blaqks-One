import React from 'react';

/** Control and action icons. Paths use a 24px grid with round caps (see Icon.jsx). */
export const actionIcons = {
  check: (
    <>
      <path d="m4 12 5 5L20 6" />
    </>
  ),
  chevron: (
    <>
      <path d="m9 18 6-6-6-6" />
    </>
  ),
  down: (
    <>
      <path d="m6 9 6 6 6-6" />
    </>
  ),
  bolt: (
    <>
      <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8z" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </>
  ),
  up: (
    <>
      <path d="m6 15 6-6 6 6" />
    </>
  ),
  filter: (
    <>
      <path d="M3 5h18M7 12h10M10 19h4" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5M4 16v5h16v-5" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18M6 6l12 12" />
    </>
  ),
  edit: (
    <>
      <path d="m15 5 4 4M4 20l5-1 12-12-4-4L5 15z" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M10 4h4M6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" />
    </>
  ),
  link: (
    <>
      <path d="m10 13 4-4M8 16H7a5 5 0 0 1 0-10h4M16 8h1a5 5 0 0 1 0 10h-4" />
    </>
  ),
  external: (
    <>
      <path d="M14 3h7v7M10 14 21 3" />
      <path d="M21 13v7H4V3h7" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" fill="currentColor" />
      <circle cx="16" cy="17" r="3" fill="currentColor" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2m20 0h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </>
  ),
  moon: (
    <>
      <path d="M20.8 14.6A9 9 0 0 1 9.4 3.2 9 9 0 1 0 20.8 14.6Z" />
    </>
  ),
};
