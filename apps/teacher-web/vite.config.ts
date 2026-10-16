import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Authenticated API responses and media are never cached by the service worker; only the app shell is.
export const teacherWorkbox = { navigateFallbackDenylist: [/^\/api(?:\/|$)/], runtimeCaching: [] };

export default defineConfig(({ command }) => ({
  define: { __API_URL__: JSON.stringify(process.env.VITE_API_URL ?? (command === 'serve' ? 'http://localhost:3000' : 'https://api.passionedu.org')), __CSRF_COOKIE_NAME__: JSON.stringify(process.env.VITE_CSRF_COOKIE_NAME ?? 'teacher_csrf') },
  server: { port: 5175, strictPort: true },
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
    manifest: {
      name: 'PassionEdu Giáo viên',
      short_name: 'Giáo viên',
      description: 'Điểm danh, nhận xét và nhắn tin phụ huynh cho lớp được phân công.',
      lang: 'vi',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      background_color: '#F7F8F3',
      theme_color: '#247A51',
      icons: [
        { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: teacherWorkbox,
  })],
}));
