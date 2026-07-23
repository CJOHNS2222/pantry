
import path from 'path';
import { defineConfig, loadEnv, type ESBuildOptions } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import checker from 'vite-plugin-checker';

export default defineConfig(({ mode }) => {
    const _env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // TypeScript type-checking in the browser overlay during dev (errors surface without running tsc separately)
        ...(mode !== 'production' ? [checker({ typescript: true })] : []),
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
      // In production, disable the OXC transformer so the esbuild transformer
      // can run with the `drop` option (OXC and esbuild transforms cannot both
      // be active at once — Vite 8 emits a warning if they are).
      // OXC minification (build.minify default) is unaffected by this.
      ...(mode === 'production' ? {
        oxc: false as const,
        esbuild: { drop: ['console', 'debugger'] } as ESBuildOptions,
      } : {}),
      build: {
        sourcemap: mode !== 'production',
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              // Firebase and database operations
              if (id.includes('firebase/')) {
                return 'firebase-vendor';
              }
              // Note: first-party app files (geminiService, analyticsService, appUtils) are
              // intentionally NOT force-split here. Forcing a single first-party module into
              // its own named chunk fights Rollup's dependency-graph-based splitting — it ends
              // up sweeping in whatever shared code is reachable only alongside that module,
              // producing a chunk whose size has nothing to do with the named file itself.
              // Letting Rollup's automatic splitting handle first-party code means it naturally
              // separates anything only reachable via a lazy (React.lazy/dynamic import())
              // boundary, which is what actually keeps it out of the eager bundle.
              // UI components and icons
              if (id.includes('lucide-react')) {
                return 'ui-vendor';
              }
              // Barcode scanning - loaded on demand, large decoder lib
              if (id.includes('@zxing/library')) {
                return 'barcode-vendor';
              }
              // OCR - loaded on demand, large WASM-backed lib
              if (id.includes('tesseract.js')) {
                return 'ocr-vendor';
              }
              // Default chunk for everything else
              return undefined;
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
