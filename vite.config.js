import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },

  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core', '@ffmpeg/core-mt'],
  },

  worker: {
    format: 'es',
  },

  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        globIgnores: ['ffmpeg/**'],
        runtimeCaching: [
          {
            urlPattern: /\/ffmpeg\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ffmpeg-wasm-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },

      manifest: {
        name: 'VidSqueeze',
        short_name: 'VidSqueeze',
        description: 'Client-side video compression in your browser',
        display: 'standalone',
        start_url: '/',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
