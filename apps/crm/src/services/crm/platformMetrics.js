/**
 * Blaqks One's platform figures (BO1d, docs/blaqks-one-console.md §3 item 4): counts and
 * platform-wide sums only. Per-company rows carry usage, never money; the server refuses
 * everyone but Blaqks One.
 */
export function platformMetricsRoutes({ request }) {
  return {
    platformMetrics: (period, signal) =>
      request(`/platform/metrics?period=${encodeURIComponent(period)}`, { signal }),
  };
}
