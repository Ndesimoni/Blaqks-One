import React from 'react';

/** Record, figure and listing content icons. Paths use a 24px grid with round caps (see Icon.jsx). */
export const contentIcons = {
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-8M15 7h6v6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10m6 10V4m6 16v-7m5 7H2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  note: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l4 3" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="15" rx="2" />
      <path d="M3 10h18M16 15h2M6 6V3h11" />
    </>
  ),
  money: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M5 9v6M19 9v6" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7h.01" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m4 18 5-5 4 3 3-5 4 6" />
    </>
  ),
  layers: (
    <>
      <rect x="4" y="4" width="15" height="15" rx="2" />
      <path d="M8 22h11a3 3 0 0 0 3-3V8" />
    </>
  ),
  bed: (
    <>
      <path d="M3 17V6M21 17V6M3 14h18M5 14V9h14v5M3 19v-2h18v2" />
    </>
  ),
  bath: (
    <>
      <path d="M4 14h16v2a7 7 0 0 1-14 0v-2M3 14h18M7 14V7a3 3 0 0 1 6 0" />
    </>
  ),
};
