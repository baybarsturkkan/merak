import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { veriPlugin } from './tools/veri-plugin.ts';

// GitHub Pages adresi: https://<kullanıcı>.github.io/merak/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/merak/' : '/',
  plugins: [
    react(),
    veriPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Merak — genel kültür',
        short_name: 'Merak',
        description: 'Bilimsel bulgulara dayalı genel kültür: aralıklı tekrar, ön test, merak ve okuma günlüğü.',
        lang: 'tr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#f9f9f7',
        theme_color: '#2a78d6',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: 'index.html',
        // GitHub API yanıtları önbelleğe alınmaz; veriler IndexedDB'de tutulur
        navigateFallbackDenylist: [/^\/__veri/],
      },
    }),
  ],
}));
