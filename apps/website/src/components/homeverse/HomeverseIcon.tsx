const paths: Record<string, string> = {
  home: 'M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7',
  handshake: 'm3 8 5-3 4 2 4-2 5 3-3 8-4 4-4-2-4-2-3-8m5-3 4 2-4 4 2 2 4-3 5 6M2 7l3-2m14 0 3 2',
  support: 'M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v7h4v-7Zm16 0h2v7h-4v-7Zm0 7v2h-8',
  shield: 'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7L12 3Zm-4 9 3 3 5-6',
};
export function HomeverseIcon({ name = 'home' }: { name?: string }) {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.home} />
    </svg>
  );
}
