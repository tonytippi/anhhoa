import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({ define: { __API_URL__: JSON.stringify(process.env.VITE_API_URL ?? 'https://api.passionedu.org'), __CSRF_COOKIE_NAME__: JSON.stringify(process.env.VITE_CSRF_COOKIE_NAME ?? 'teacher_csrf') }, plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'PassionEdu Teacher', short_name: 'Giáo viên', display: 'standalone' }, workbox: { runtimeCaching: [] } })] });
