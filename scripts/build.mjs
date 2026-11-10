#!/usr/bin/env node
/**
 * Production build for Chrome Extension (Manifest V3).
 * Uses esbuild to produce a flat dist/ ready for Load unpacked.
 */
import { build } from 'esbuild';
import {
  mkdirSync,
  cpSync,
  existsSync,
  readFileSync,
  writeFileSync,
  rmSync,
  copyFileSync,
} from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

async function main() {
  if (existsSync(dist)) {
    rmSync(dist, { recursive: true, force: true });
  }
  mkdirSync(join(dist, 'assets'), { recursive: true });
  mkdirSync(join(dist, 'icons'), { recursive: true });

  const shared = {
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    logLevel: 'info',
  };

  await build({
    ...shared,
    entryPoints: [resolve(root, 'src/popup/popup.ts')],
    outfile: join(dist, 'popup.js'),
  });

  await build({
    ...shared,
    entryPoints: [resolve(root, 'src/dashboard/dashboard.ts')],
    outfile: join(dist, 'dashboard.js'),
  });

  await build({
    ...shared,
    entryPoints: [resolve(root, 'src/background/service-worker.ts')],
    outfile: join(dist, 'background.js'),
  });

  copyFileSync(resolve(root, 'src/popup/popup.css'), join(dist, 'assets/popup.css'));
  copyFileSync(resolve(root, 'src/dashboard/dashboard.css'), join(dist, 'assets/dashboard.css'));

  const iconsSrc = resolve(root, 'public/icons');
  if (existsSync(iconsSrc)) {
    cpSync(iconsSrc, join(dist, 'icons'), { recursive: true });
  }

  const popupHtml = readFileSync(resolve(root, 'src/popup/popup.html'), 'utf8')
    .replace('href="./popup.css"', 'href="./assets/popup.css"')
    .replace('src="./popup.ts"', 'src="./popup.js"');
  writeFileSync(join(dist, 'popup.html'), popupHtml);

  let dashHtml = readFileSync(resolve(root, 'src/dashboard/dashboard.html'), 'utf8');
  dashHtml = dashHtml.replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>\s*/g, '');
  dashHtml = dashHtml.replace('href="./dashboard.css"', 'href="./assets/dashboard.css"');
  dashHtml = dashHtml.replace('src="./dashboard.ts"', 'src="./dashboard.js"');
  if (!dashHtml.includes('dashboard.js')) {
    dashHtml = dashHtml.replace('</body>', '  <script type="module" src="./dashboard.js"></script>\n</body>');
  }
  writeFileSync(join(dist, 'dashboard.html'), dashHtml);

  let optionsHtml = readFileSync(resolve(root, 'src/options/options.html'), 'utf8');
  optionsHtml = optionsHtml.replace('../dashboard/dashboard.html', 'dashboard.html');
  writeFileSync(join(dist, 'options.html'), optionsHtml);

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
      extension_pages: "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'",
    },
  };
  writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('Build complete → dist/');
  console.log('Load unpacked: select the dist folder in chrome://extensions');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
