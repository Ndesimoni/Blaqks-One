/** A drawn listing image (sky, sun, towers and water) for the sample gallery. */
export function Scene({
  sky,
  sun,
  seed,
  water,
}: {
  sky: [string, string, string];
  sun: [number, number];
  seed: number;
  water: string;
}) {
  let n = seed;
  const rand = () => ((n = (n * 9301 + 49297) % 233280), n / 233280);
  const towers = Array.from({ length: 16 }, (_, i) => ({
    x: i * 26 - 10,
    w: 18 + rand() * 26,
    h: 70 + rand() * 210,
  }));
  const id = `sky-${seed}`;
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="0.6" stopColor={sky[1]} />
          <stop offset="1" stopColor={sky[2]} />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill={`url(#${id})`} />
      <circle cx={sun[0]} cy={sun[1]} r="46" fill="#f6dcaa" opacity="0.9" />
      {towers.map((t, i) => (
        <rect
          key={i}
          x={t.x}
          y={400 - t.h}
          width={t.w}
          height={t.h}
          fill="#0b1711"
          opacity={0.75 + (i % 3) * 0.08}
        />
      ))}
      <rect y="398" width="400" height="102" fill={water} />
      {towers.slice(0, 8).map((t, i) => (
        <rect
          key={`r${i}`}
          x={t.x}
          y="402"
          width={t.w}
          height={t.h * 0.25}
          fill="#0b1711"
          opacity="0.25"
        />
      ))}
    </svg>
  );
}
