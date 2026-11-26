/** A small trend line for a figure, scaled to its own range. */
export function Spark({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const line = points
    .map((p, i) => `${(i / (points.length - 1)) * 100},${24 - ((p - min) / (max - min || 1)) * 20}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={line}
        fill="none"
        style={{ stroke: color }}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
