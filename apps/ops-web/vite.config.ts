import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => ({
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL ?? (command === 'serve' ? 'http://localhost:3000' : 'https://api.passionedu.org')),
    __CSRF_COOKIE_NAME__: JSON.stringify(process.env.VITE_CSRF_COOKIE_NAME ?? 'ops_csrf'),
  },
  server: { port: 5176, strictPort: true },
  plugins: [
    react(),
    VitePWA({ registerType: 'autoUpdate', manifest: { name: 'PassionEdu Ops', short_name: 'Ops', display: 'standalone' }, workbox: { runtimeCaching: [] } }),
  ],
}));
