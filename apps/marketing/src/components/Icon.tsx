import type { IconName } from '@/lib/products';

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const shapes: Record<IconName, React.ReactNode> = {
  home: (
    <g {...line}>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </g>
  ),
  crm: (
    <g {...line}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.5 3 5.2" />
    </g>
  ),
  web: (
    <g {...line}>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </g>
  ),
  market: (
    <g {...line}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </g>
  ),
  chat: (
    <g {...line}>
      <path d="M4 5h16v11H9l-5 4V5z" />
    </g>
  ),
  gear: (
    <g {...line}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </g>
  ),
  bell: (
    <g {...line}>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z" />
      <path d="M10 21h4" />
    </g>
  ),
  logo: (
    <g {...line}>
      <path d="M4 20V9l8-5 8 5v11" />
      <path d="M9 20v-6h6v6" />
    </g>
  ),
  sun: (
    <g {...line}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </g>
  ),
  moon: (
    <g {...line}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </g>
  ),
  spark: <path fill="currentColor" d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />,
};

/** The site's line icons, drawn in the current text colour. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {shapes[name]}
    </svg>
  );
}
