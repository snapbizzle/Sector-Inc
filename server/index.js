// Self-hosted quote-form backend for Sector Technology's site, for use
// when the site is served from Bryce's own server (e.g. behind Caddy)
// instead of Cloudflare Pages. Serves the built static site from ../dist
// and handles POST /api/quote the same way the Cloudflare Pages Function
// (../functions/api/quote.js) does, using the Resend email API.
//
// Setup:
//   1. npm install
//   2. npm run build        (generates ../dist)
//   3. cp .env.example .env  and fill in RESEND_API_KEY, QUOTE_TO_EMAIL,
//      QUOTE_FROM_EMAIL
//   4. npm start             (or: node server/index.js)
//
// See README.md for the full self-hosting walkthrough (Caddy reverse
// proxy config, systemd service, etc).

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resend } from 'resend';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const PORT = process.env.PORT || 8080;
const { RESEND_API_KEY, QUOTE_TO_EMAIL, QUOTE_FROM_EMAIL } = process.env;

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const MACHINE_LABELS = {
  photon: 'Photon',
  gamma: 'Gamma',
  spectrum: 'Spectrum',
  'sti-550hd': 'STI-550HD',
  'sti-200hd': 'STI-200HD',
  'sti-100hd': 'STI-100HD',
  'sti-800hd': 'STI-800HD',
  retrofit: 'Retrofit',
  'spare-parts': 'Spare Parts',
  'trade-in': 'Trade-In',
  used: 'Used Machinery',
};

function validateQuoteFields(fields) {
  const errors = [];
  const name = String(fields.name ?? '').trim();
  const email = String(fields.email ?? '').trim();

  if (!name) errors.push('Name is required.');
  if (!email) {
    errors.push('Email is required.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email address looks invalid.');
  }

  const honeypot = String(fields.website ?? '').trim();
  if (honeypot) errors.push('Spam check failed.');

  return errors;
}

function buildQuoteEmail(fields) {
  const name = String(fields.name ?? '').trim();
  const email = String(fields.email ?? '').trim();
  const company = String(fields.company ?? '').trim();
  const phone = String(fields.phone ?? '').trim();
  const address = String(fields.address ?? '').trim();
  const machineKey = String(fields.machine ?? '').trim();
  const machine = MACHINE_LABELS[machineKey] ?? (machineKey || 'Not specified');
  const comments = String(fields.comments ?? '').trim();

  const rows = [
    ['Name', name],
    ['Company', company || '—'],
    ['Email', email],
    ['Phone', phone || '—'],
    ['Address', address || '—'],
    ['Machine of Interest', machine],
    ['Comments', comments || '—'],
  ];

  const text = rows.map(([label, value]) => `${label}: ${value}`).join('\n');
  const html = `<table cellpadding="6" cellspacing="0">${rows
    .map(
      ([label, value]) =>
        `<tr><td style="font-weight:600;vertical-align:top;">${label}</td><td>${String(value).replace(/\n/g, '<br/>')}</td></tr>`
    )
    .join('')}</table>`;

  return {
    subject: `New quote request from ${name}${company ? ` (${company})` : ''}`,
    text,
    html,
    replyTo: email,
  };
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/quote', async (req, res) => {
  const fields = req.body ?? {};
  const wantsJson = (req.headers.accept || '').includes('application/json');

  const errors = validateQuoteFields(fields);
  if (errors.length > 0) {
    if (wantsJson) return res.status(400).json({ error: errors.join(' ') });
    return res.redirect(303, '/quote/?error=1');
  }

  if (!resend || !QUOTE_TO_EMAIL || !QUOTE_FROM_EMAIL) {
    console.error('Quote form is not configured: missing RESEND_API_KEY, QUOTE_TO_EMAIL, or QUOTE_FROM_EMAIL.');
    const message = 'The quote form is not fully configured yet. Please call or email us directly.';
    if (wantsJson) return res.status(500).json({ error: message });
    return res.redirect(303, '/quote/?error=1');
  }

  const { subject, text, html, replyTo } = buildQuoteEmail(fields);

  try {
    const { error } = await resend.emails.send({
      from: QUOTE_FROM_EMAIL,
      to: QUOTE_TO_EMAIL,
      reply_to: replyTo,
      subject,
      text,
      html,
    });
    if (error) throw error;
  } catch (err) {
    console.error('Resend send failed:', err);
    const message = 'Could not send your request right now. Please call or email us instead.';
    if (wantsJson) return res.status(502).json({ error: message });
    return res.redirect(303, '/quote/?error=1');
  }

  if (wantsJson) return res.json({ ok: true });
  return res.redirect(303, '/quote/thank-you/');
});

// Serve the pre-built static site (run `npm run build` first).
app.use(express.static(distDir, { extensions: ['html'] }));

app.use((req, res) => {
  res.status(404).sendFile(path.join(distDir, '404.html'), (err) => {
    if (err) res.status(404).send('Not found');
  });
});

app.listen(PORT, () => {
  console.log(`Sector Technology site + quote API listening on http://localhost:${PORT}`);
  if (!resend) {
    console.warn('RESEND_API_KEY not set — /api/quote will return an error until it is configured.');
  }
});
