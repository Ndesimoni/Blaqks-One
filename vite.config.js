import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'CRM_');
  return {
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
