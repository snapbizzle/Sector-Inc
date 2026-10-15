// Cloudflare Pages Function — handles POST /api/quote.
//
// Required environment variables (set in the Cloudflare Pages dashboard
// under Settings > Environment variables, or via `wrangler secret put`):
//   RESEND_API_KEY   — API key from https://resend.com
//   QUOTE_TO_EMAIL    — inbox that should receive quote requests
//   QUOTE_FROM_EMAIL  — verified "from" address in your Resend domain
//                        (e.g. quotes@sectortechnologyinc.com)
//
// See README.md for full setup instructions.

import { validateQuoteFields, buildQuoteEmail } from '../_shared/quote.js';

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
  const contentType = request.headers.get('content-type') || '';
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');

  let fields;
  try {
    if (contentType.includes('application/json')) {
      fields = await request.json();
    } else {
      const formData = await request.formData();
      fields = Object.fromEntries(formData.entries());
    }
  } catch {
    return wantsJson
      ? jsonResponse({ error: 'Could not read form data.' }, 400)
      : Response.redirect(new URL('/quote/?error=1', request.url), 303);
  }

  const errors = validateQuoteFields(fields);
  if (errors.length > 0) {
    return wantsJson
      ? jsonResponse({ error: errors.join(' ') }, 400)
      : Response.redirect(new URL('/quote/?error=1', request.url), 303);
  }

  if (!env.RESEND_API_KEY || !env.QUOTE_TO_EMAIL || !env.QUOTE_FROM_EMAIL) {
    console.error('Quote form is not configured: missing RESEND_API_KEY, QUOTE_TO_EMAIL, or QUOTE_FROM_EMAIL.');
    return wantsJson
      ? jsonResponse({ error: 'The quote form is not fully configured yet. Please call or email us directly.' }, 500)
      : Response.redirect(new URL('/quote/?error=1', request.url), 303);
  }

  const { subject, text, html, replyTo } = buildQuoteEmail(fields);

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.QUOTE_FROM_EMAIL,
      to: env.QUOTE_TO_EMAIL,
      reply_to: replyTo,
      subject,
      text,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const detail = await resendResponse.text().catch(() => '');
    console.error('Resend API error:', resendResponse.status, detail);
    return wantsJson
      ? jsonResponse({ error: 'Could not send your request right now. Please call or email us instead.' }, 502)
      : Response.redirect(new URL('/quote/?error=1', request.url), 303);
  }

  return wantsJson
    ? jsonResponse({ ok: true }, 200)
    : Response.redirect(new URL('/quote/thank-you/', request.url), 303);
}

// Reject non-POST methods explicitly rather than falling through to a
// generic 404 from static asset serving.
export async function onRequestGet() {
  return jsonResponse({ error: 'Method not allowed.' }, 405);
}
