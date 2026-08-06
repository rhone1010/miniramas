import { NextRequest, NextResponse } from 'next/server';

/* ------------------------------------------------------------------ *
 *  Liten & Co — soft-launch access gate + static page routing
 *
 *  1. Home is the workshop: / serves public/portraits.html.
 *     The old homepage is still reachable at /home.
 *  2. Gate: ungated visits get the real page with a dimmed overlay and
 *     the passcode card above it. The cookie is a session cookie, so it
 *     dies when the browser closes, and it also expires after an hour
 *     of inactivity — whichever comes first. /logout ends it.
 *
 *  The page behind the gate is real and therefore readable by anyone
 *  who views source. Rich's call, 2026-08-06: accepted.
 *
 *  /api/* is NOT matched. Stripe and Prodigi webhooks must reach the
 *  server without a cookie — gating them means credits never land.
 * ------------------------------------------------------------------ */

const COOKIE = 'liten_access';
const IDLE_MS = 60 * 60 * 1000; // 1 hour of inactivity
const BYPASS = 'x-liten-gate-bypass';

/* Extensionless paths -> files in public/. Anything absent 404s
   honestly rather than resolving somewhere wrong. */
const PAGES: Record<string, string> = {
  '/': '/portraits.html',
  '/portraits': '/portraits.html',
  '/home': '/index.html',
  '/wallpapers': '/portrait-wallpaper.html',
  '/portrait-wallpaper': '/portrait-wallpaper.html',
  '/pet-wallpaper': '/pet-wallpaper.html',
};

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

const ASSET =
  /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|map|json|woff2?|ttf|otf|eot|mp4|webm|txt|xml|bin)$/i;

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;

  /* The gate fetches the page for itself. Let that request through
     untouched or it recurses into the gate forever. */
  if (req.headers.get(BYPASS)) return NextResponse.next();

  const code = process.env.LITEN_ACCESS_CODE;

  /* No code configured -> gate is off entirely. Local dev stays open. */
  if (!code) return route(req, url);

  /* Assets pass ungated: the gate needs its own figures and mark, and
     the page behind it needs its images. */
  if (ASSET.test(url.pathname)) return NextResponse.next();

  /* Deliberate end of session. */
  if (url.pathname === '/logout') {
    const res = NextResponse.redirect(new URL('/', url.origin));
    res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }

  /* Correct code supplied -> issue the session, redirect to the clean
     URL so the code never sits in the address bar or a screenshot. */
  const supplied = url.searchParams.get('access');
  if (supplied !== null && supplied === code) {
    const clean = new URL(url.toString());
    clean.searchParams.delete('access');
    const res = NextResponse.redirect(clean);
    issue(res, code);
    return res;
  }

  /* Already through, and not idle too long. Every page request
     re-stamps the cookie, so the hour is idle time, not total. */
  if (valid(req.cookies.get(COOKIE)?.value, code)) {
    const res = route(req, url);
    issue(res, code);
    return res;
  }

  /* Otherwise: the real page, with the gate over it. */
  return gatedPage(req, url, supplied !== null);
}

/* Cookie value is the code and the time it was last seen, so the idle
   window is checked without any server-side store. No maxAge: the
   cookie dies when the browser closes. */
function issue(res: NextResponse, code: string) {
  res.cookies.set(COOKIE, code + '|' + Date.now(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

function valid(value: string | undefined, code: string) {
  if (!value) return false;
  const cut = value.lastIndexOf('|');
  if (cut === -1) return false;
  if (value.slice(0, cut) !== code) return false;
  const seen = Number(value.slice(cut + 1));
  if (!Number.isFinite(seen)) return false;
  return Date.now() - seen < IDLE_MS;
}

function target(url: URL) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return PAGES[path];
}

function route(req: NextRequest, url: URL) {
  const t = target(url);
  if (t) return NextResponse.rewrite(new URL(t, url));
  return NextResponse.next();
}

async function gatedPage(req: NextRequest, url: URL, wrong: boolean) {
  /* Which page sits behind the card. Unknown paths get the workshop
     rather than a bare card on nothing. */
  const behind = target(url) || '/portraits.html';

  let html = '';
  try {
    const res = await fetch(new URL(behind, url.origin), {
      headers: { [BYPASS]: '1' },
    });
    if (res.ok) html = await res.text();
  } catch {
    html = '';
  }

  /* If the page could not be read, the card still has to appear —
     a blank screen is worse than a card on an empty backdrop. */
  if (!html) {
    html = '<!doctype html><html><head><meta charset="utf-8">' +
      '<title>Liten &amp; Co</title></head><body></body></html>';
  }

  const overlay = gate(wrong);
  const i = html.toLowerCase().lastIndexOf('</body>');
  const out = i === -1 ? html + overlay : html.slice(0, i) + overlay + html.slice(i);

  return new NextResponse(out, {
    status: 401,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function gate(wrong: boolean) {
  return `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet">
<style id="lg-style">
  html.lg-locked, html.lg-locked body{ overflow:hidden !important; }

  #lg-scrim{
    position:fixed; inset:0; z-index:2147483000;
    background:rgba(20,15,12,.25);
    -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px);
  }
  #lg-wrap{
    position:fixed; inset:0; z-index:2147483001;
    display:flex; align-items:center; justify-content:center;
    padding:40px 24px; overflow:auto;
    font-family:'Cormorant Garamond',Georgia,serif;
    color:#2a241e;
  }
  #lg-card{
    --oxblood:#7d4242; --brass:#75623a; --ink:#2a241e;
    position:relative; width:100%; max-width:860px;
    background:linear-gradient(170deg,#f2ebdf 0%,#e9e1d3 46%,#e4dbca 100%);
    border-radius:18px; overflow:hidden;
    box-shadow:0 40px 90px rgba(0,0,0,.55);
    padding:52px 48px 40px;
    text-align:center;
  }
  #lg-card::after{
    content:''; position:absolute; inset:0; pointer-events:none;
    background-image:radial-gradient(rgba(42,36,30,.045) 1px, transparent 1px);
    background-size:3px 3px;
  }

  #lg-card .lg-fig{
    position:absolute; bottom:0; height:74%; width:auto; z-index:1;
    pointer-events:none; user-select:none;
  }
  #lg-card .lg-w{ left:0;
    -webkit-mask-image:linear-gradient(to right,#000 44%,transparent 95%);
            mask-image:linear-gradient(to right,#000 44%,transparent 95%); }
  #lg-card .lg-m{ right:0;
    -webkit-mask-image:linear-gradient(to left,#000 44%,transparent 95%);
            mask-image:linear-gradient(to left,#000 44%,transparent 95%); }
  #lg-card .lg-fade{
    position:absolute; left:0; right:0; bottom:0; height:48%; z-index:2;
    background:linear-gradient(to bottom,rgba(233,225,211,0) 0%,#e7dfd0 60%,#e4dbca 100%);
    pointer-events:none;
  }

  #lg-card .lg-inner{ position:relative; z-index:3; }
  #lg-card .lg-mark{ display:block; margin:0 auto 20px; width:252px; max-width:60%; height:auto; }

  #lg-card .lg-rule{
    display:flex; align-items:center; justify-content:center; gap:14px;
    margin:0 auto 36px; max-width:330px;
  }
  #lg-card .lg-rule i{ flex:1; height:1px; background:rgba(117,98,58,.42); }
  #lg-card .lg-rule s{ color:#75623a; font-size:11px; line-height:1; text-decoration:none; }

  #lg-card h1{
    font-family:'Cormorant Garamond',Georgia,serif;
    font-weight:500; font-size:50px; line-height:1.1; color:#2a241e;
    margin:0 0 14px; letter-spacing:.005em;
  }
  #lg-card .lg-lede{
    font-style:italic; font-size:26px; line-height:1.4;
    color:#7d4242; margin:0 0 26px;
  }
  #lg-card .lg-body{
    font-size:23px; line-height:1.55; color:#2a241e;
    margin:0 auto 18px; max-width:26em;
  }

  #lg-card form{ margin:44px auto 0; max-width:580px; text-align:left; }
  #lg-card label{
    display:block; font-family:'Manrope',system-ui,sans-serif;
    font-size:12px; font-weight:600; letter-spacing:.2em;
    text-transform:uppercase; color:#75623a; margin:0 0 10px 4px;
  }
  #lg-card .lg-field{ position:relative; }
  #lg-card input{
    width:100%; padding:.85rem 3.2rem .85rem 1.3rem;
    font-family:'Cormorant Garamond',Georgia,serif; font-size:22px;
    color:#2a241e; background:#f6f1e7;
    border:1px solid rgba(117,98,58,.38); border-radius:12px;
    box-shadow:none;
  }
  #lg-card input::placeholder{ color:rgba(42,36,30,.42); }
  #lg-card input:focus{ outline:none; border-color:#7d4242; }
  #lg-card .lg-eye{
    position:absolute; top:50%; right:14px; transform:translateY(-50%);
    background:none; border:none; cursor:pointer; padding:6px;
    color:#75623a; line-height:0;
  }
  #lg-card .lg-go{
    display:block; width:100%; margin:18px 0 0;
    font-family:'Manrope',system-ui,sans-serif;
    font-size:15px; font-weight:600; letter-spacing:.16em; text-transform:uppercase;
    color:#f3ece0; background:#3a2a22;
    border:none; border-radius:12px; padding:1.05rem 1rem; cursor:pointer;
  }
  #lg-card .lg-go:hover{ background:#7d4242; }
  #lg-card .lg-err{
    font-family:'Manrope',system-ui,sans-serif; font-size:13px;
    color:#7d4242; margin:12px 0 0; min-height:1.2em; text-align:center;
  }

  #lg-card .lg-foot{ margin-top:30px; }
  #lg-card .lg-foot .lg-rule{ margin-bottom:14px; }
  #lg-card .lg-foot p{
    font-style:italic; font-size:21px; color:rgba(42,36,30,.7); margin:0;
  }

  @media (max-width:820px){
    #lg-card .lg-fig{ display:none; }
    #lg-card{ padding:40px 24px 32px; }
    #lg-card h1{ font-size:38px; }
    #lg-card .lg-lede{ font-size:23px; }
    #lg-card .lg-body{ font-size:21px; }
  }
</style>

<div id="lg-scrim"></div>
<div id="lg-wrap">
  <div id="lg-card">
    <img class="lg-fig lg-w" src="/gate/gate_woman_image.png" alt="">
    <img class="lg-fig lg-m" src="/gate/gate_man_image.png" alt="">
    <div class="lg-fade"></div>

    <div class="lg-inner">
      <img class="lg-mark" src="/gate/liten-and-co.svg" alt="Liten &amp; Co">

      <div class="lg-rule"><i></i><s>&#9670;</s><i></i></div>

      <h1>You&rsquo;re Invited</h1>
      <p class="lg-lede">Liten &amp; Co is in soft launch.</p>
      <p class="lg-body">We&rsquo;re opening our doors to a select group of testers and family.</p>
      <p class="lg-body">Enter your passcode to explore.</p>

      <form method="GET" autocomplete="off">
        <label for="lg-access">Passcode</label>
        <div class="lg-field">
          <input id="lg-access" type="password" name="access" placeholder="Enter passcode">
          <button type="button" class="lg-eye" id="lg-eye" aria-label="Show passcode">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z"/>
              <circle cx="12" cy="12" r="3.2"/>
            </svg>
          </button>
        </div>
        <button type="submit" class="lg-go">Unlock Access</button>
        <p class="lg-err">${wrong ? 'That passcode was not recognised.' : ''}</p>
      </form>

      <div class="lg-foot">
        <div class="lg-rule"><i></i><s>&#10047;</s><i></i></div>
        <p>Thank you for helping us shape something beautiful.</p>
      </div>
    </div>
  </div>
</div>

<script>
(function(){
  document.documentElement.classList.add('lg-locked');
  var f = document.getElementById('lg-access');
  var e = document.getElementById('lg-eye');
  if(f){ try{ f.focus(); }catch(_){} }
  if(f && e){
    e.addEventListener('click', function(){
      var showing = f.type === 'text';
      f.type = showing ? 'password' : 'text';
      e.setAttribute('aria-label', showing ? 'Show passcode' : 'Hide passcode');
      f.focus();
    });
  }
})();
</script>
`;
}
