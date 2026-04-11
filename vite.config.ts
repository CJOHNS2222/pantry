
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import checker from 'vite-plugin-checker';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // TypeScript type-checking in the browser overlay during dev (errors surface without running tsc separately)
        checker({ typescript: true }),
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
      // Strip console.* and debugger statements in production builds
      esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
      build: {
        sourcemap: mode !== 'production',
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
        chunkSizeWarningLimit: 600 // Reduce to 600KB to encourage smaller chunks
      },
      // Bundle visualizer: run `npm run build:analyze` to open treemap at dist/stats.html
      ...(mode === 'analyze' ? {
        plugins: [
          visualizer({ open: true, filename: 'dist/stats.html', gzipSize: true, brotliSize: true })
        ]
      } : {}),
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
      }
    };
  });
