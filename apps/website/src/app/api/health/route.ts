// Liveness for the hosting health checks (docs/hosting.md#monitoring): the Next.js process
// answers. It reads no site, host or public API, so any hostname gets the same reply.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { status: 'ok', service: 'blaqks-website' },
    { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
  );
}
