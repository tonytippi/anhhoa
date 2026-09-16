import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: { __API_URL__: JSON.stringify(process.env.VITE_API_URL ?? 'https://api.passionedu.org') },
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'PassionEdu Phụ huynh', short_name: 'Phụ huynh', start_url: '/', display: 'standalone', background_color: '#F7F8F3', theme_color: '#247A51', icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] }, workbox: { navigateFallbackDenylist: [/^\/api(?:\/|$)/, /payment|media|evidence/i], runtimeCaching: [] } })],
});
