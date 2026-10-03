import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['wardrobe.svg', 'apple-touch-icon.png'],
      workbox: {
        globIgnores: ['**/*.wasm'],
        runtimeCaching: [
          {
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-runtime',
              expiration: { maxEntries: 2, maxAgeSeconds: 31536000 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      manifest: {
        name: 'Wardrobe',
        short_name: 'Wardrobe',
        description: 'A private, local-first digital wardrobe.',
        theme_color: '#f4f0e9',
        background_color: '#f4f0e9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          {
            src: './wardrobe.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: './icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
});
