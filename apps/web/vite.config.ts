import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: { __API_URL__: JSON.stringify(process.env.VITE_API_URL ?? 'https://api.passionedu.org') },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: { name: 'PassionEdu Quản trị', short_name: 'Quản trị', display: 'standalone' },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'], navigateFallbackDenylist: [/^\/api(?:\/|$)/] },
    }),
  ],
});
