// Shared request-parsing/validation logic for the quote form endpoint.
// Used by the Cloudflare Pages Function (functions/api/quote.js). The
// self-hosted Express server (server/index.js) re-implements the same
// rules directly since it runs in a different (Node, not Workers) runtime
// and has its own body-parsing middleware.

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

export function validateQuoteFields(fields) {
  const errors = [];
  const name = String(fields.name ?? '').trim();
  const email = String(fields.email ?? '').trim();

  if (!name) errors.push('Name is required.');
  if (!email) {
    errors.push('Email is required.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email address looks invalid.');
  }

  // Honeypot: a real visitor never fills this in (it's hidden via CSS).
  const honeypot = String(fields.website ?? '').trim();
  if (honeypot) errors.push('Spam check failed.');

  return errors;
}

export function buildQuoteEmail(fields) {
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
