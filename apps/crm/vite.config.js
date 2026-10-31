import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

// The shared .env stays at the repository root (layout move RL1, 2026-10-30).
const envDir = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, 'CRM_');
  return {
    envDir,
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api/calendar': 'http://127.0.0.1:8787',
        '/api/crm': env.CRM_API_PROXY || 'http://127.0.0.1:8788',
      },
    },
    preview: { port: 4173 },
  };
});
