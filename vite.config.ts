
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          manifest: {
            name: 'Stock & Spoon',
            short_name: 'StockSpoon',
            start_url: '/',
            display: 'standalone',
            background_color: '#570404ff',
            theme_color: '#a51401ff',
            description: 'Manage your pantry, plan meals, and find recipes easily.',
            icons: [
              {
                src: 'icons/icon192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'icons/icon512.png',
                sizes: '512x512',
                type: 'image/png'
              }
            ],
            orientation: 'portrait'
          }
        })
      ],
      define: {
        'process.env.npm_package_version': JSON.stringify(process.env.npm_package_version || '1.0.0'),
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      },
      // Avoid embedding raw GEMINI API keys into the built bundle.
      // The app should use `import.meta.env.VITE_GEMINI_API_KEY` at runtime instead.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        sourcemap: true,
        rollupOptions: {
          output: {
            manualChunks: {
              // Firebase and database operations
              'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/analytics', 'firebase/storage'],
              // AI and ML services - split Gemini separately as it's largest
              'gemini-service': ['./services/geminiService'],
              'analytics-service': ['./services/analyticsService'],
              // Utility functions
              'utils': ['./utils/appUtils'],
              // UI components and icons
              'ui-vendor': ['lucide-react']
            }
          }
        },
        chunkSizeWarningLimit: 1000 // Increase limit to 1000KB since our chunks are reasonably sized
      },
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
      }
    };
  });
