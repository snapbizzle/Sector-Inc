#!/usr/bin/env node
// Prefixes root-relative URLs in the built site with a base path, for
// hosting under a subpath such as GitHub Pages project sites
// (https://<user>.github.io/<repo>/). Run after `npm run build`.
//
// The source keeps plain root-relative links ("/machines/") so the
// production build (served from the domain root) is unaffected; this
// only rewrites dist/ for the test deployment.
//
// Usage: node scripts/pages-base.mjs /sector-inc

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

const base = '/' + (process.argv[2] ?? '').replace(/^\/+|\/+$/g, '');
if (base === '/') {
  console.error('Usage: node scripts/pages-base.mjs <base-path>');
  process.exit(1);
}
if (!existsSync(distDir)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (['.html', '.css'].includes(extname(entry))) files.push(full);
  }
  return files;
}

// href="/x", src="/x", action="/x", srcset="/x" — but not protocol-relative "//x".
const attrPattern = /(\s(?:href|src|action|srcset|poster)=["'])\/(?!\/)/g;
// CSS url(/x)
const cssUrlPattern = /url\((["']?)\/(?!\/)/g;

let changed = 0;
for (const file of walk(distDir)) {
  const before = readFileSync(file, 'utf8');
  const after = before
    .replace(attrPattern, `$1${base}/`)
    .replace(cssUrlPattern, `url($1${base}/`);
  if (after !== before) {
    writeFileSync(file, after);
    changed++;
  }
}
console.log(`Rewrote root-relative URLs under ${base}/ in ${changed} files.`);
