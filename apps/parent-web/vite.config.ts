import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// push-sw.js only shows notifications; it caches nothing.
export const parentWorkbox = { navigateFallbackDenylist: [/^\/api(?:\/|$)/, /payment|media|evidence/i], runtimeCaching: [], importScripts: ['push-sw.js'] };

export default defineConfig(({ command }) => ({
  define: { __API_URL__: JSON.stringify(process.env.VITE_API_URL ?? (command === 'serve' ? 'http://localhost:3000' : 'https://api.passionedu.org')), __CSRF_COOKIE_NAME__: JSON.stringify(process.env.VITE_CSRF_COOKIE_NAME ?? 'parent_csrf') },
  server: { port: 5174, strictPort: true },
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'PassionEdu Phụ huynh', short_name: 'Phụ huynh', start_url: '/', display: 'standalone', background_color: '#F7F8F3', theme_color: '#247A51', icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }, { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }] }, workbox: parentWorkbox })],
}));
