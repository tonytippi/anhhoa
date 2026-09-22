import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => ({
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL ?? (command === 'serve' ? 'http://localhost:3000' : 'https://api.passionedu.org')),
    __CSRF_COOKIE_NAME__: JSON.stringify(process.env.VITE_CSRF_COOKIE_NAME ?? 'app_csrf'),
  },
  server: { port: 5173, strictPort: true },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: { name: 'PassionEdu Quản trị', short_name: 'Quản trị', display: 'standalone' },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'], navigateFallbackDenylist: [/^\/api(?:\/|$)/] },
    }),
  ],
}));
