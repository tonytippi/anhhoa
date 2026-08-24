import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: { port: 5174, strictPort: true, proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true, rewrite: (path) => path.replace(/^\/api(?=\/|$)/, '') } } },
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Ánh Hoa Phụ huynh', short_name: 'Ánh Hoa', start_url: '/', display: 'standalone', background_color: '#fff9ed', theme_color: '#8b4513', icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] }, workbox: { navigateFallbackDenylist: [/^\/api\//], runtimeCaching: [] } })],
});
