import { after } from 'node:test';
import { createServer } from 'vite';

/**
 * A loader for app modules through Vite's SSR compiler, since the unit runner cannot parse JSX.
 * The server closes once the importing file's tests have run.
 */
export async function viteLoader() {
  const vite = await createServer({
    root: process.cwd(),
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true },
    logLevel: 'error',
  });
  after(() => vite.close());
  return (path) => vite.ssrLoadModule(path);
}
