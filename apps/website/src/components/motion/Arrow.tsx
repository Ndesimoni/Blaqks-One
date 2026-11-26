/** A decorative link arrow; it nudges towards its destination on hover and keyboard focus. */
export function Arrow({ up = false }: { up?: boolean }) {
  return (
    <span className={up ? 'motion-arrow motion-arrow-up' : 'motion-arrow'} aria-hidden="true">
      {up ? '↗' : '→'}
    </span>
  );
}
