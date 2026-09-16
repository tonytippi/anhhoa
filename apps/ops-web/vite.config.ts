import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({ define: { __API_URL__: JSON.stringify(process.env.VITE_API_URL ?? 'https://api.passionedu.org') }, plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'PassionEdu Ops', short_name: 'Ops', display: 'standalone' }, workbox: { runtimeCaching: [] } })] });
