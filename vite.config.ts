import { defineConfig } from 'vite';
import { resolve } from 'path';
import { mkdirSync, cpSync, existsSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';

/**
 * Chrome Extension production build.
 * Final dist layout:
 *   manifest.json, popup.html, dashboard.html, options.html, background.js,
 *   popup.js, dashboard.js, options.js, assets/, icons/, chunks/
 */
export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: true,
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        dashboard: resolve(__dirname, 'src/dashboard/dashboard.html'),
        options: resolve(__dirname, 'src/options/options.html'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background.js';
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    {
      name: 'chrome-extension-pack',
      closeBundle() {
        const dist = resolve(__dirname, 'dist');

        // Icons
        const iconsSrc = resolve(__dirname, 'public/icons');
        const iconsDest = resolve(dist, 'icons');
        mkdirSync(iconsDest, { recursive: true });
        if (existsSync(iconsSrc)) {
          cpSync(iconsSrc, iconsDest, { recursive: true });
        }

        // Production manifest (paths match flattened dist)
        const manifest = {
          manifest_version: 3,
          name: 'Personal Finance & Expense Intelligence',
          short_name: 'Finance Intelligence',
          version: '1.0.0',
          description:
            'Local-first personal finance tracker with advanced spending analytics, budgets, savings goals, and reports. Your data never leaves your device.',
          icons: {
            '16': 'icons/icon16.png',
            '48': 'icons/icon48.png',
            '128': 'icons/icon128.png',
          },
          action: {
            default_popup: 'popup.html',
            default_title: 'Finance Intelligence',
            default_icon: {
              '16': 'icons/icon16.png',
              '48': 'icons/icon48.png',
            },
          },
          background: {
            service_worker: 'background.js',
            type: 'module',
          },
          options_page: 'options.html',
          permissions: ['storage', 'alarms'],
          host_permissions: [],
          content_security_policy: {
            extension_pages:
              "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'",
          },
        };
        writeFileSync(resolve(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));

        // Flatten HTML from nested Vite output into dist root
        const candidates = [
          ['src/popup/popup.html', 'popup.html'],
          ['src/dashboard/dashboard.html', 'dashboard.html'],
          ['src/options/options.html', 'options.html'],
          ['popup.html', 'popup.html'],
          ['dashboard.html', 'dashboard.html'],
          ['options.html', 'options.html'],
        ];

        for (const [fromRel, toName] of candidates) {
          const from = resolve(dist, fromRel);
          if (!existsSync(from)) continue;
          let html = readFileSync(from, 'utf-8');
          // Normalize relative asset paths from nested folders up to dist root
          html = html.replace(/(href|src)="(\.\.\/)+/g, '$1="');
          writeFileSync(resolve(dist, toName), html);
        }

        // Remove empty nested src tree if present
        const nestedSrc = resolve(dist, 'src');
        if (existsSync(nestedSrc)) {
          try {
            rmSync(nestedSrc, { recursive: true, force: true });
          } catch {
            /* ignore */
          }
        }
      },
    },
  ],
});
