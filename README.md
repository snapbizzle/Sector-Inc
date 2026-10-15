# Sector Technology Inc. — Website

A complete rebuild of sectortechnologyinc.com, replacing the 2012-era, hand-coded HTML site (28
near-duplicate machine pages, a dead JS nav menu, a broken `mailto:` quote form, no mobile layout,
zero alt text) with a modern, accessible, fast, statically-generated site.

- **Framework:** [Astro](https://astro.build) 7 (static output, ships zero JS by default)
- **Styling:** Tailwind CSS v4 (CSS-first `@theme` config, no `tailwind.config.js`)
- **Content:** one YAML file per machine (`src/content/machines/*.yaml`), validated against a Zod
  schema (`src/content.config.ts`) — editing a spec means editing a YAML file, not HTML
- **Quote form:** a real, working backend (Resend email API), with both a Cloudflare Pages
  Function and a self-hosted Express option — see **Quote form setup** below

All page copy was migrated from a direct crawl of the live site (not just the audit summary), with
typos silently corrected and anything that could change factual meaning preserved and flagged — see
**Items requiring your input** below.

## Local development

```bash
npm install
npm run dev        # http://localhost:4321
```

```bash
npm run build       # outputs to dist/
npm run preview     # serve the production build locally
npm run linkcheck    # crawl dist/ and fail if any internal link or image is broken
```

`npm run linkcheck` must be run after `npm run build`. It found and confirmed **zero broken
internal links or missing images** across all 27 pages as of this build.

## Editing content

- **Machine specs/equipment/copy:** edit the matching file in `src/content/machines/` (e.g.
  `photon.yaml`). Fields are documented with comments in `src/content.config.ts`. A missing numeric
  spec should be left as `null`, not guessed — the site will render "Data required" rather than a
  fabricated number.
- **Page copy** (About, Processes, Services, etc.): edit the `.astro` file directly under
  `src/pages/`.
- **Nav links:** `src/components/Header.astro` and `Footer.astro`.
- **Images:** `public/images/`. Always set meaningful `alt` text — there is none on the old site at
  all, and it's one of the audit's top accessibility findings.

## Deployment

### Test deployment — GitHub Pages

Every push to `main` builds and deploys the site via `.github/workflows/deploy-pages.yml` to
`https://<user>.github.io/<repo>/`. Because that is a subpath, the workflow runs
`scripts/pages-base.mjs` after the build to prefix internal links with `/<repo>/` (the source and
production build are unchanged). One-time setup: **Settings → Pages → Build and deployment →
Source: GitHub Actions**. Note: GitHub Pages is static-only, so the quote form's `/api/quote`
backend and the `_redirects` 301s do not work there.

### Option A — Cloudflare Pages (recommended)

1. Push this repo to GitHub/GitLab and connect it in the Cloudflare Pages dashboard, or deploy
   directly with `npx wrangler pages deploy dist`.
2. Build command: `npm run build` — output directory: `dist`.
3. The `functions/api/quote.js` file is auto-detected by Pages as a Function — no extra config.
4. Set three environment variables in **Settings → Environment variables** (see **Quote form
   setup** below): `RESEND_API_KEY`, `QUOTE_TO_EMAIL`, `QUOTE_FROM_EMAIL`.
5. `public/_redirects` is picked up automatically for the old-URL → new-URL 301 redirects.
6. Point `sectortechnologyinc.com` DNS at the Pages project (or your new `sector.us` domain, if/when
   you migrate — update `site` in `astro.config.mjs` to match first).

### Option B — Netlify

Same as Cloudflare Pages (`public/_redirects` is Netlify's native format too), except the quote
form needs a Netlify Function instead of a Pages Function — `functions/api/quote.js` can be adapted
with minimal changes (same validation/email logic in `functions/_shared/quote.js`), or simpler: run
it as a Netlify "Edge Function"/serverless function pointed at `/api/quote`. Ask if you'd like this
wired up.

### Option C — Self-hosted (e.g. your own server behind Caddy)

This matches the self-hosting approach from the original recommendations doc.

```bash
npm install
npm run build          # generates dist/
cp .env.example .env    # fill in RESEND_API_KEY, QUOTE_TO_EMAIL, QUOTE_FROM_EMAIL
npm run serve            # node server/index.js — serves dist/ AND handles POST /api/quote
```

Example Caddy reverse-proxy config:

```
sectortechnologyinc.com {
    reverse_proxy localhost:8080
}
```

For the old-URL redirects in this setup, either keep `public/_redirects` and have `server/index.js`
read it (ask if you want this added), or add an equivalent `redir` block to your Caddyfile.

Run it as a systemd service (or `pm2`) so it restarts on reboot/crash — ask if you'd like a sample
unit file.

## Quote form setup

The old site's quote form submitted to a personal Gmail address (`jasonworrix@gmail.com`) via a
plain `mailto:` link, which most browsers block or mishandle — effectively a broken form. The new
form (`/quote/`) posts to `/api/quote`, which emails the submission via
[Resend](https://resend.com):

1. Create a Resend account and verify a sending domain (e.g. `sectortechnologyinc.com` or
   whatever domain you're sending from).
2. Create an API key.
3. Set `RESEND_API_KEY`, `QUOTE_TO_EMAIL` (e.g. `sales@sectortechnologyinc.com`), and
   `QUOTE_FROM_EMAIL` (a verified address on your sending domain, e.g.
   `quotes@sectortechnologyinc.com`) — either as Cloudflare Pages environment variables, or in a
   local `.env` file for the self-hosted server (see `.env.example`).

The form works with JavaScript (inline success/error message, no page reload) and without it
(standard form POST, redirects to `/quote/thank-you/`). It includes a honeypot field for basic spam
filtering.

## Content decisions made during the rebuild

Flagging these explicitly since they're judgment calls, not pure migration:

- **Dropped: Downloads, Video, and News pages.** All three were empty/stale "coming soon"
  placeholders or a single 2012 news post on the old site. Rather than ship another dead page, they
  were removed from navigation; their old URLs redirect to the homepage. Easy to add back once
  there's real content.
- **Merged: Support page into Contact.** The two pages had near-duplicate content (address/phone/
  email). `/contact/` now covers both sales and support inquiries; `/support.html` redirects there.
- **Products page dropped as a standalone page.** The old `products.html` was just three links
  (Machines / Controls / Plasma Systems); that's now just the "Products" nav dropdown, and the old
  URL redirects to `/machines/`.
- **Used Machinery page rewritten to not list specific inventory.** The old copy said "we will
  update this page to show what equipment we currently have" but never did. Rather than repeat that
  promise, the new copy asks visitors to contact Sector directly for current availability.
- **Partners page rebuilt without logos.** The old page displayed six logo images from broken local
  file paths; only one (Praxair) was identifiable from context. Rather than guess at the other five
  or reuse a trademarked logo without permission, the new page lists the OEM/brand relationships
  Sector's own site text confirms elsewhere (Hypertherm, ITT Kaliburn/Burny, Thermal Dynamics,
  Thermadyne, Bosch Rexroth, Harris, Victor, Oxweld). **If you'd like real logos displayed, send
  current licensed logo files and we'll add them** — flagged on the page itself too.
- **Homepage hero copy migrated from an image, not HTML.** The old homepage's marketing paragraph
  ("Sector Technology is devoted solely to serving the needs...") was baked into a JPEG
  (`body1.jpg`) with no alt text — not real text at all. It's now real, readable, typo-corrected
  text in the new homepage's HTML.
- **"6 Experienced Service Engineers" (old Technical Service page) not repeated as a number.** That
  headcount is 14 years stale and unverifiable; the new Technical Service page describes the team
  without a specific count. Let us know the current number if you'd like it featured.
- **301 redirects for every old URL** are in `public/_redirects`, mapping all 28 old machine pages,
  all info/service pages, and the dropped pages, to their new clean-URL equivalents — this preserves
  existing search rankings and any external links/bookmarks.

## Items requiring your input

Carried over from the per-machine `dataGaps` fields (also shown as an on-page callout on the
relevant machine's page) plus the items above:

1. **Photon** — standard equipment lists a 320W AC *brush* drive, while every other model in the
   line lists an AC *brushless* drive at higher wattage. Confirm this is an intentional
   cost-reduced entry-level spec, not a legacy typo.
2. **Gamma** — traverse speed is published at 1,000 IPM; a 2026 competitive check found at least
   one named competitor (Hornet Cutting Systems) publishing roughly double that at a comparable
   tier. Confirm this figure is still current.
3. **STI-550HD** — the old Specs page never published an oxy-fuel cutting capacity or lifter speed,
   unlike every other model. Carried forward as a genuine gap rather than an estimate — please
   supply current values if this machine offers oxy-fuel cutting.
4. **STI-550HD** — traverse speed (1,000–2,000 IPM) is the fastest in the line, but a 2026
   competitive check found a named competitor publishing 3,000 IPM at the same precision tier.
   Confirm this figure is current.
5. **STI-100HD** — oxy-fuel capacity is published at 30", well beyond any named 2026 competitor
   (typically 4–6" for multi-torch straight cutting). Sector's own Oxy-Fuel process page supports
   this as a real, long-standing capability ("over 40 years... helping to develop the process of
   cutting over 30 inch material") rather than a typo — but please confirm before it's featured as a
   headline differentiator.
6. **STI-800HD** — oxy-fuel capacity (30") and drilling capacity (4" diameter) both substantially
   exceed named 2026 competitors in the drill/plasma combination category (typically ~2.75–3" for
   drilling). Please confirm these are current before they're featured as headline differentiators.
7. **Partners page** — needs real, current, licensed partner/OEM logos (see above).
8. **Technical Service page** — let us know the current service engineer headcount if you'd like a
   specific number featured again.
9. **Used Machinery page** — if you'd like specific current inventory listed instead of a
   "contact us" prompt, send photos/descriptions and we can add a simple listing.
10. **Domain** — this build's `astro.config.mjs` defaults to `sectortechnologyinc.com`. If/when you
    migrate to `sector.us` (mentioned in earlier project discussion), update the `site` value there
    and the redirect/canonical URLs will follow automatically.

## QA performed

- `npm run build` — 27 pages generated, **zero build errors**.
- `npm run linkcheck` — **zero broken internal links or images** across the full built site.
- Every `<img>` on every generated page has real, descriptive `alt` text (verified by scanning
  `dist/` for any `<img>` missing an `alt` attribute — none found).
- Every page has exactly one `<h1>`, a unique `<title>`, a unique meta description, a `viewport`
  meta tag, and `lang="en"` (verified by scanning `dist/`).
- Visual QA via Playwright screenshots at desktop (1440px) and mobile (390px) widths across the
  homepage, machines listing, a machine detail page, the compare table, the quote form, Partners,
  and About.
- `sitemap-index.xml` and `robots.txt` are generated/included and reference each other.
