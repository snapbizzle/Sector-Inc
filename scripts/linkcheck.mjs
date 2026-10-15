#!/usr/bin/env node
// Static link checker for the built site. Run `npm run build` first.
//
// Walks every generated HTML file in dist/, extracts href/src targets,
// and verifies that every internal link resolves to a real file in the
// build output. Flags anything broken so a dead link never ships.
//
// Usage: node scripts/linkcheck.mjs

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

if (!existsSync(distDir)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (extname(entry) === '.html') files.push(full);
  }
  return files;
}

const htmlFiles = walk(distDir);
const hrefPattern = /\s(?:href|src)="([^"]+)"/g;

/** Resolve a site-relative link (e.g. "/machines/photon/") to a dist/ file path. */
function resolveLink(link) {
  let p = link.split('#')[0].split('?')[0];
  if (!p) return null; // pure fragment link
  if (!p.startsWith('/')) return 'SKIP'; // relative — none used in this project
  if (p === '/') return join(distDir, 'index.html');
  const direct = join(distDir, p);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const asIndex = join(distDir, p, 'index.html');
  if (existsSync(asIndex)) return asIndex;
  const withHtml = direct + (direct.endsWith('/') ? 'index.html' : '.html');
  if (existsSync(withHtml)) return withHtml;
  return 'MISSING';
}

let brokenCount = 0;
const seen = new Map(); // link -> first page it was found broken on

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(hrefPattern)) {
    const link = match[1];

    if (
      link.startsWith('mailto:') ||
      link.startsWith('tel:') ||
      link.startsWith('http://') ||
      link.startsWith('https://') ||
      link.startsWith('data:') ||
      link.startsWith('//') ||
      link === '#'
    ) {
      continue;
    }

    const resolved = resolveLink(link);
    if (resolved === 'MISSING') {
      if (!seen.has(link)) {
        seen.set(link, file.replace(distDir, ''));
        brokenCount++;
      }
    }
  }
}

if (brokenCount === 0) {
  console.log(`✔ Link check passed — ${htmlFiles.length} pages scanned, no broken internal links or assets found.`);
  process.exit(0);
} else {
  console.error(`✘ Found ${brokenCount} broken internal link(s):\n`);
  for (const [link, page] of seen) {
    console.error(`  ${link}  (first seen on ${page})`);
  }
  process.exit(1);
}
