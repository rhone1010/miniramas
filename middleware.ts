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

  /* coffee, half strength */
  #lg-scrim{
    position:fixed; inset:0; z-index:2147483000;
    background:rgba(51,38,32,.5);
  }
  #lg-wrap{
    position:fixed; inset:0; z-index:2147483001;
    display:flex; align-items:center; justify-content:center;
    padding:32px 20px; overflow:auto;
    font-family:'Cormorant Garamond',Georgia,serif;
  }

  /* Flat light ground. No blend modes: a dark noise texture multiplied over
     this turned the whole card brown and took the text with it. Grain is a
     dot overlay on top instead, where it cannot darken anything. */
  #lg-card{
    position:relative; width:100%; max-width:660px;
    background-color:#f2ebdf;
    background-image:linear-gradient(163deg,#f7f2e8 0%,#f1e9d9 42%,#e9dfcc 78%,#e3d8c2 100%);
    border-radius:20px; overflow:hidden;
    box-shadow:0 50px 110px rgba(0,0,0,.6), 0 0 0 1px rgba(123,92,58,.18);
    padding:0 0 40px;
    color:#2a241e;
  }
  #lg-card::after{
    content:''; position:absolute; inset:0; pointer-events:none; z-index:4;
    background-image:radial-gradient(rgba(42,36,30,.04) 1px, transparent 1px);
    background-size:3px 3px;
  }

  /* --- figures: anchored top, fading inward and downward --------- */
  #lg-card .lg-figs{
    position:relative; height:400px; margin-bottom:-190px;
  }
  #lg-card .lg-fig{
    position:absolute; top:0; height:400px; width:auto; z-index:1;
    pointer-events:none; user-select:none;
  }
  #lg-card .lg-w{ left:0;
    -webkit-mask-image:linear-gradient(to right,#000 40%,transparent 92%);
            mask-image:linear-gradient(to right,#000 40%,transparent 92%); }
  #lg-card .lg-m{ right:0;
    -webkit-mask-image:linear-gradient(to left,#000 40%,transparent 92%);
            mask-image:linear-gradient(to left,#000 40%,transparent 92%); }
  #lg-card .lg-fade{
    position:absolute; left:0; right:0; top:0; height:440px; z-index:2;
    background:linear-gradient(to bottom,
      rgba(247,242,232,0) 0%,
      rgba(245,239,227,.35) 42%,
      rgba(242,235,221,.82) 66%,
      #efe7d6 84%, #ece3d0 100%);
    pointer-events:none;
  }

  /* --- content --------------------------------------------------- */
  #lg-card .lg-inner{ position:relative; z-index:3; padding:44px 52px 0; text-align:center; }
  #lg-card .lg-mark{ display:block; margin:0 auto 14px; width:230px; max-width:64%; height:auto; }

  #lg-card .lg-rule{
    display:flex; align-items:center; justify-content:center; gap:16px;
    margin:0 auto 176px; max-width:400px;
  }
  #lg-card .lg-rule i{ flex:1; height:1px;
    background:linear-gradient(to right,rgba(182,138,83,0),rgba(182,138,83,.55),rgba(182,138,83,0)); }
  #lg-card .lg-rule s{ color:#b68a53; font-size:12px; line-height:1; text-decoration:none; }

  #lg-card h1{
    font-family:'Cormorant Garamond',Georgia,serif;
    font-weight:500; font-size:54px; line-height:1.08; color:#2a241e;
    margin:0 0 14px; letter-spacing:.004em;
  }
  #lg-card .lg-lede{
    font-style:italic; font-size:27px; line-height:1.35;
    color:#7d4242; margin:0 0 28px;
  }
  #lg-card .lg-body{
    font-size:23px; line-height:1.5; color:#3d352c;
    margin:0 auto 18px; max-width:19em;
  }

  /* --- form ------------------------------------------------------ */
  #lg-card form{ margin:46px auto 0; max-width:520px; text-align:left; }
  #lg-card label{
    display:block; font-family:'Manrope',system-ui,sans-serif;
    font-size:13px; font-weight:600; letter-spacing:.22em;
    text-transform:uppercase; color:#75623a; margin:0 0 12px 2px;
  }
  #lg-card .lg-field{ position:relative; }
  #lg-card input{
    width:100%; padding:.95rem 3.4rem .95rem 1.4rem;
    font-family:'Cormorant Garamond',Georgia,serif; font-size:24px;
    color:#2a241e; background:#f8f4ea;
    border:1px solid rgba(123,92,58,.34); border-radius:14px;
    box-shadow:inset 0 1px 3px rgba(42,36,30,.05);
  }
  #lg-card input::placeholder{ color:rgba(42,36,30,.4); }
  #lg-card input:focus{ outline:none; border-color:#7d4242; }
  #lg-card .lg-eye{
    position:absolute; top:50%; right:16px; transform:translateY(-50%);
    background:none; border:none; cursor:pointer; padding:6px;
    color:#75623a; line-height:0;
  }
  #lg-card .lg-go{
    display:block; width:100%; margin:20px 0 0;
    font-family:'Manrope',system-ui,sans-serif;
    font-size:16px; font-weight:600; letter-spacing:.18em; text-transform:uppercase;
    color:#f2e9d8; background:linear-gradient(180deg,#3f2e23,#332620);
    border:none; border-radius:14px; padding:1.15rem 1rem; cursor:pointer;
    box-shadow:0 2px 10px rgba(38,32,26,.28);
  }
  #lg-card .lg-go:hover{ background:linear-gradient(180deg,#7d4242,#6b3838); }
  #lg-card .lg-err{
    font-family:'Manrope',system-ui,sans-serif; font-size:14px;
    color:#7d4242; margin:14px 0 0; min-height:1.2em; text-align:center;
  }

  #lg-card .lg-foot{ margin-top:36px; }
  #lg-card .lg-foot .lg-rule{ margin-bottom:18px; max-width:340px; }
  #lg-card .lg-foot p{
    font-style:italic; font-size:22px; color:rgba(61,53,44,.72); margin:0;
  }

  @media (max-width:700px){
    #lg-card .lg-figs{ height:300px; margin-bottom:-160px; }
    #lg-card .lg-fig{ height:300px; }
    #lg-card .lg-fade{ height:330px; }
    #lg-card .lg-inner{ padding:32px 24px 0; }
    #lg-card .lg-rule{ margin-bottom:130px; }
    #lg-card h1{ font-size:40px; }
    #lg-card .lg-lede{ font-size:24px; }
    #lg-card .lg-body{ font-size:22px; }
  }
</style>

<div id="lg-scrim"></div>
<div id="lg-wrap">
  <div id="lg-card">
    <div class="lg-figs">
      <img class="lg-fig lg-w" src="/gate/gate_woman_image.png" alt="">
      <img class="lg-fig lg-m" src="/gate/gate_man_image.png" alt="">
      <div class="lg-fade"></div>
    </div>

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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
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
