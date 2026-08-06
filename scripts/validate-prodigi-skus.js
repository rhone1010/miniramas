/* scripts/validate-prodigi-skus.js — 2026-08-03 · CUI V25
 *
 * Asks Prodigi which of the candidate square SKUs actually exist, and what
 * each one needs.
 *
 * WHY THIS EXISTS
 *   The prefixes are confirmed and the WIDTHxHEIGHT construction is known to
 *   behave — GLOBAL-BOX-12X12 is direct evidence. What is NOT confirmed is
 *   that every family carries every square size. Prodigi's public product
 *   pages do not expose every variant, and their own guidance is that the
 *   API lookup is authoritative.
 *
 *   A SKU that does not exist fails at the quote, which the customer sees as
 *   a shipping error with no explanation, on a page where they were about to
 *   pay. So nothing goes into sku-map.ts that has not answered here.
 *
 * WHAT IT DOES
 *   GET /v4.0/products/{sku} for every candidate. Records the description,
 *   the real product dimensions, and the pixel resolution the print area
 *   wants — which is the number that decides whether a 2K render needs
 *   upscaling for that size.
 *
 *   Then POST /v4.0/quotes for each survivor, one copy to the US, to get the
 *   wholesale cost. Retail is Rich's to set; this gives him the floor.
 *
 * OUTPUT
 *   A table to the terminal, and scripts/prodigi-skus.json for the build
 *   that writes sku-map.ts.
 *
 * RUN
 *   node scripts/validate-prodigi-skus.js
 *   node scripts/validate-prodigi-skus.js --live      (default: sandbox)
 *
 *   Reads PRODIGI_API_KEY, or PRODIGI_SANDBOX_API_KEY when sandboxed, from
 *   .env.local. The key is never printed.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'prodigi-skus.json');

/* PRODIGI_ENV is the repo's own switch and migration 012 leans on it, so
   this follows it rather than inventing a second source of truth. --live
   overrides for a one-off check. */
const LIVE = process.argv.includes('--live');
const BASE = LIVE
  ? 'https://api.prodigi.com/v4.0'
  : 'https://api.sandbox.prodigi.com/v4.0';

/* The grid. Six families, four squares — Portraits renders 1:1, so every
   rectangular SKU would letterbox or crop the customer's face. */
const FAMILIES = [
  { key: 'fine_art',      prefix: 'GLOBAL-FAP',     label: 'Fine Art Print' },
  { key: 'premium',       prefix: 'GLOBAL-HPR',     label: 'Premium Fine Art Print' },
  { key: 'canvas',        prefix: 'GLOBAL-CAN',     label: 'Canvas' },
  { key: 'framed_canvas', prefix: 'GLOBAL-FRA-CAN', label: 'Framed Canvas' },
  { key: 'framed',        prefix: 'GLOBAL-CFP',     label: 'Classic Framed Print' },
  { key: 'matted',        prefix: 'GLOBAL-CFPM',    label: 'Matted Classic Frame' },
];

const SIZES = ['8X8', '12X12', '16X16', '20X20'];

// ── the key, without printing it ────────────────────────────────────────────
function readEnv() {
  const p = path.join(ROOT, '.env.local');
  if (!fs.existsSync(p)) return {};
  const out = {};
  fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((line) => {
    // Any key name, not just SCREAMING_SNAKE — Rich's are lowercase and
    // hyphenated, and the first cut of this silently matched none of them.
    const m = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
  return out;
}

const env = Object.assign({}, readEnv(), process.env);
/* Both spellings. The repo uses hyphenated lowercase; the underscored
   uppercase forms are here so this keeps working if that is ever tidied. */
const LIVE_NAMES = ['PRODIGI_KEY_LIVE', 'PRODIGI_API_KEY'];
const SANDBOX_NAMES = ['PRODIGI_KEY_SANDBOX', 'PRODIGI_SANDBOX_API_KEY'];

function firstOf(names) {
  for (const n of names) if (env[n]) return env[n];
  return null;
}

const KEY = LIVE ? firstOf(LIVE_NAMES) : (firstOf(SANDBOX_NAMES) || firstOf(LIVE_NAMES));

if (!KEY) {
  const wanted = LIVE ? LIVE_NAMES : SANDBOX_NAMES.concat(LIVE_NAMES);
  console.error('No API key in .env.local. Looked for: ' + wanted.join(', '));
  console.error('Keys found in the file: ' +
    (Object.keys(env).filter((k) => /prodigi/i.test(k)).join(', ') || 'none matching /prodigi/i'));
  process.exit(1);
}

const headers = { 'X-API-Key': KEY, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* No timeout meant a slow call and a hung script looked identical from the
   outside. Fifteen seconds, then move on and say so. */
const TIMEOUT_MS = 15000;

async function ask(url, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, Object.assign({ signal: ctl.signal }, init));
  } finally {
    clearTimeout(t);
  }
}

async function productDetails(sku) {
  const res = await ask(`${BASE}/products/${sku}`, { headers });
  if (res.status === 404) return { found: false, reason: 'not found' };
  if (!res.ok) return { found: false, reason: `http ${res.status}` };
  const body = await res.json();
  if (!body || body.outcome !== 'Ok' || !body.product) {
    return { found: false, reason: body && body.outcome ? body.outcome : 'no product' };
  }
  const p = body.product;
  const variant = (p.variants && p.variants[0]) || {};
  const area = (variant.printAreaSizes && variant.printAreaSizes.default) || {};
  return {
    found: true,
    sku: p.sku,
    description: p.description || '',
    dimensions: p.productDimensions || null,
    requiredPx: (area.horizontalResolution && area.verticalResolution)
      ? { w: area.horizontalResolution, h: area.verticalResolution }
      : null,
    shipsToCount: Array.isArray(variant.shipsTo) ? variant.shipsTo.length : null,
    attributes: p.attributes || {},
  };
}

/* Wholesale, so Rich can set retail against a real floor rather than a
   guess. One copy, to the US, cheapest shipping. */
async function wholesale(sku) {
  const res = await ask(`${BASE}/quotes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      shippingMethod: 'Budget',
      destinationCountryCode: 'US',
      currencyCode: 'USD',
      items: [{ sku, copies: 1, assets: [{ printArea: 'default' }] }],
    }),
  });
  if (!res.ok) {
    // Say why. Every quote came back empty on the first run and there was
    // nothing on screen to explain it.
    let detail = '';
    try { detail = JSON.stringify(await res.json()).slice(0, 300); } catch (e) {}
    return { error: `http ${res.status} ${detail}` };
  }
  const body = await res.json();
  const q = body && body.quotes && body.quotes[0];
  if (!q || !q.costSummary) {
    return { error: 'no quote in response: ' + JSON.stringify(body).slice(0, 300) };
  }
  const cents = (v) => Math.round(parseFloat(v && v.amount ? v.amount : '0') * 100);
  return {
    itemsCents: cents(q.costSummary.items),
    shippingCents: cents(q.costSummary.shipping),
  };
}

(async function main() {
  console.log('[validator build 3 — with quote diagnostics]');
  console.log(`Asking Prodigi (${LIVE ? 'LIVE' : 'sandbox'}) about ` +
              `${FAMILIES.length * SIZES.length} candidates.`);
  console.log(`${BASE}\n`);

  const results = [];

  for (const fam of FAMILIES) {
    for (const size of SIZES) {
      const sku = `${fam.prefix}-${size}`;
      // Printed BEFORE the call, so a stall names the SKU it stalled on.
      process.stdout.write(`  ${sku} … `);
      let d;
      try {
        d = await productDetails(sku);
      } catch (e) {
        d = { found: false, reason: e.name === 'AbortError' ? 'timed out' : (e.message || 'threw') };
      }
      console.log(d.found ? 'ok' : d.reason);
      const row = Object.assign({ family: fam.key, label: fam.label, size }, d);
      if (d.found) {
        try {
          row.wholesale = await wholesale(sku);
        } catch (e) {
          // A quote that will not come is not fatal, but it must not be
          // silent — the first run reported nothing at all.
          row.wholesale = {
            error: e.name === 'AbortError' ? 'timed out' : (e.message || 'threw'),
          };
        }
      }
      results.push(row);
      await sleep(120);   // polite
    }
  }

  // ── the table ─────────────────────────────────────────────────────────────
  const money = (c) => (c == null ? '—' : '$' + (c / 100).toFixed(2));
  let lastFamily = null;
  results.forEach((r) => {
    if (r.family !== lastFamily) {
      console.log(`\n${r.label}`);
      lastFamily = r.family;
    }
    if (!r.found) {
      console.log(`  ✗ ${r.size.padEnd(7)} ${r.reason}`);
      return;
    }
    const dim = r.dimensions
      ? `${r.dimensions.width}×${r.dimensions.height}${r.dimensions.units}`
      : '?';
    const px = r.requiredPx ? `${r.requiredPx.w}×${r.requiredPx.h}px` : 'px unknown';
    const cost = (r.wholesale && r.wholesale.itemsCents != null)
      ? money(r.wholesale.itemsCents)
      : (r.wholesale && r.wholesale.error ? 'quote failed' : '—');
    console.log(`  ✓ ${r.size.padEnd(7)} ${dim.padEnd(12)} ${px.padEnd(14)} cost ${cost}`);
  });

  const ok = results.filter((r) => r.found);
  console.log(`\n${ok.length} of ${results.length} exist.`);

  // If the quotes failed they failed for one reason; print it once.
  const priced = ok.filter((r) => r.wholesale && r.wholesale.itemsCents != null);
  if (!priced.length) {
    const firstErr = ok.map((r) => r.wholesale && r.wholesale.error).filter(Boolean)[0];
    console.log('\nNO WHOLESALE PRICES CAME BACK.');
    console.log('  ' + (firstErr || 'no reason recorded — the quote returned null'));
    console.log('  Without these, retail is a guess. Prodigi\'s dashboard has a');
    console.log('  pricing and shipping tool that exports the same numbers.');
  }

  /* The one that decides whether the upscaler is needed per size. A 2K
     render is 2048² and anything wanting more than that needs the webhook
     to enlarge it before Prodigi ever sees it. */
  const over = ok.filter((r) => r.requiredPx && r.requiredPx.w > 2048);
  if (over.length) {
    console.log(`${over.length} want more than 2048px and will need upscaling:`);
    over.forEach((r) => console.log(`  ${r.sku} → ${r.requiredPx.w}px`));
  }

  /* The matted frame question. If a CFPM SKU reports dimensions matching its
     own name, the size in the SKU is the GLAZE and the image inside it is
     smaller — which would sell a customer a print four inches short. */
  const matted = ok.filter((r) => r.family === 'matted');
  if (matted.length) {
    console.log('\nMATTED FRAMES — check before selling:');
    matted.forEach((r) => {
      const d = r.dimensions;
      console.log(`  ${r.sku}: reports ${d ? d.width + '×' + d.height : '?'} — ` +
                  `"${r.description}"`);
    });
    console.log('  If those dimensions are the frame and not the image, the size' +
                '\n  a customer chooses is not the size they receive.');
  }

  fs.writeFileSync(OUT, JSON.stringify({
    checkedAt: new Date().toISOString(),
    environment: LIVE ? 'live' : 'sandbox',
    results,
  }, null, 2) + '\n', 'utf8');
  console.log(`\nwrote ${path.relative(ROOT, OUT)}`);
})();
