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
<style id="lg-style">
  html.lg-locked, html.lg-locked body{ overflow:hidden !important; }

  /* Everything is scoped under #lg-wrap. The workshop has its own :root,
     its own box-sizing and its own .form — an unscoped rule here would
     reach into the page underneath. */
  #lg-wrap{
    --lg-paper:#efe0c7;
    --lg-paper-light:#f6ead7;
    --lg-ink:#382117;
    --lg-gold:#b58a4c;

    position:fixed; inset:0; z-index:2147483001;
    display:grid; place-items:center;
    padding:4vh 4vw; overflow:auto;
    font-family:Georgia,"Times New Roman",serif;
    background:
      radial-gradient(circle at 50% 18%,rgba(176,126,70,.18),transparent 28%),
      linear-gradient(rgba(33,20,13,.94),rgba(18,11,8,.96));
  }
  #lg-wrap *{ box-sizing:border-box; }

  #lg-wrap .lg-gate{
    position:relative;
    width:min(74vw,930px);
    aspect-ratio:1110/1400;
    overflow:hidden;
    border-radius:3.3%;
    background:
      radial-gradient(circle at 50% 9%,rgba(255,255,255,.40),transparent 32%),
      linear-gradient(180deg,var(--lg-paper-light),var(--lg-paper));
    border:1px solid rgba(95,57,31,.72);
    box-shadow:0 34px 90px rgba(0,0,0,.54),
               inset 0 0 0 1px rgba(255,255,255,.30);
  }
  #lg-wrap .lg-gate:after{
    content:""; position:absolute; inset:0; z-index:20;
    pointer-events:none; border-radius:inherit;
    box-shadow:inset 0 0 44px rgba(77,46,26,.10);
  }

  /* PORTRAITS */
  #lg-wrap .lg-figure{
    position:absolute; z-index:1;
    bottom:20%; width:48%; height:68%;
    background-repeat:no-repeat; background-size:contain;
  }
  #lg-wrap .lg-figure-left{
    left:-4%;
    background-image:url("/gate/gate_woman_image.png");
    background-position:left bottom;
  }
  #lg-wrap .lg-figure-right{
    right:-4%;
    background-image:url("/gate/gate_man_image.png");
    background-position:right bottom;
  }
  #lg-wrap .lg-figure-fade{
    position:absolute; z-index:2; left:0; right:0;
    bottom:17%; height:27%; pointer-events:none;
    background:linear-gradient(to bottom,
      rgba(239,224,199,0) 0%,
      rgba(239,224,199,.18) 18%,
      rgba(239,224,199,.72) 62%,
      var(--lg-paper) 92%);
  }

  #lg-wrap .lg-content{
    position:absolute; inset:0; z-index:5;
    color:var(--lg-ink); text-align:center;
  }

  /* BRAND */
  #lg-wrap .lg-logo-wrap{
    position:absolute; top:5.2%; left:50%; width:48%;
    transform:translateX(-50%);
  }
  #lg-wrap .lg-brand-logo{
    display:block; width:68%; max-height:105px;
    object-fit:contain; margin:0 auto;
  }
  #lg-wrap .lg-brand-rule{
    position:relative; width:43%; height:1px; margin:4% auto 0;
    background:linear-gradient(90deg,transparent,var(--lg-gold),transparent);
  }
  #lg-wrap .lg-brand-rule:after{
    content:"\u25C6"; position:absolute; left:50%; top:50%;
    transform:translate(-50%,-52%); padding:0 .55em;
    background:var(--lg-paper-light); color:var(--lg-gold); font-size:11px;
  }

  /* CENTER COPY */
  #lg-wrap .lg-invite{
    position:absolute; top:28.5%; left:50%; width:43%;
    transform:translateX(-50%);
  }
  #lg-wrap .lg-invite h1{
    margin:0 0 3%; font-size:clamp(33px,4vw,52px); line-height:1.05;
    font-weight:500; letter-spacing:-.025em; color:var(--lg-ink);
    font-family:inherit;
  }
  #lg-wrap .lg-soft{
    margin:0 0 7%; font-size:clamp(17px,1.9vw,24px);
    font-style:italic; color:#624532;
  }
  #lg-wrap .lg-copy{
    margin:0; font-size:clamp(14px,1.45vw,19px);
    line-height:1.48; color:#4f382a;
  }

  /* PASSCODE */
  #lg-wrap .lg-form{
    position:absolute; left:50%; bottom:6.2%; width:65.5%;
    transform:translateX(-50%); text-align:left;
  }
  #lg-wrap .lg-form label{
    display:block; margin-bottom:1.7%;
    font-family:Arial,Helvetica,sans-serif;
    font-size:clamp(11px,1.05vw,14px); font-weight:700;
    letter-spacing:.17em; color:#6d4932; text-transform:none;
  }
  #lg-wrap .lg-input-shell{ position:relative; }
  #lg-wrap .lg-form input{
    width:100%; height:clamp(62px,6.8vw,80px);
    padding:0 4.3rem 0 1.45rem;
    border:1px solid rgba(92,56,35,.58); border-radius:14px; outline:none;
    background:rgba(255,255,255,.48);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.72);
    color:var(--lg-ink);
    font-family:Georgia,"Times New Roman",serif;
    font-size:clamp(18px,1.75vw,23px);
  }
  #lg-wrap .lg-form input::placeholder{ color:#9b897a; }
  #lg-wrap .lg-form input:focus{
    border-color:var(--lg-gold);
    box-shadow:0 0 0 3px rgba(181,138,76,.15);
  }
  #lg-wrap .lg-eye{
    position:absolute; right:1.25rem; top:50%; transform:translateY(-50%);
    padding:0; border:0; background:transparent; color:#68452f;
    cursor:pointer; font-size:1.5rem; line-height:1;
  }
  #lg-wrap .lg-unlock{
    display:block; width:100%; height:clamp(62px,6.7vw,79px);
    margin-top:3.2%; border:0; border-radius:13px; cursor:pointer;
    background:linear-gradient(180deg,#4b2a1a,#28150e);
    box-shadow:0 9px 20px rgba(52,29,17,.18);
    color:#e0be83; font-family:Arial,Helvetica,sans-serif;
    font-size:clamp(14px,1.35vw,18px); font-weight:500; letter-spacing:.18em;
  }
  #lg-wrap .lg-unlock:hover{ filter:brightness(1.06); }

  /* A wrong code has to say so. Sized so the layout does not jump. */
  #lg-wrap .lg-err{
    min-height:1.4em; margin:2.4% 0 0; text-align:center;
    font-family:Arial,Helvetica,sans-serif;
    font-size:clamp(12px,1.15vw,15px); color:#8d3b3b;
  }

  #lg-wrap .lg-bottom-rule{
    display:flex; align-items:center; gap:12px;
    width:92%; margin:3.2% auto 2.2%; color:var(--lg-gold);
  }
  #lg-wrap .lg-bottom-rule:before,
  #lg-wrap .lg-bottom-rule:after{
    content:""; flex:1; height:1px;
    background:linear-gradient(90deg,transparent,rgba(181,138,76,.58));
  }
  #lg-wrap .lg-bottom-rule:after{ transform:scaleX(-1); }
  #lg-wrap .lg-leaf{ font-size:17px; transform:rotate(-18deg); }

  #lg-wrap .lg-thanks{
    text-align:center; color:#78583e;
    font-size:clamp(14px,1.4vw,18px); font-style:italic;
  }

  @media(max-width:760px){
    #lg-wrap{ padding:0; }
    #lg-wrap .lg-gate{
      width:100vw; min-height:100vh; aspect-ratio:auto; border-radius:0;
    }
    #lg-wrap .lg-figure{ width:58%; height:55%; bottom:27%; opacity:.52; }
    #lg-wrap .lg-figure-left{ left:-13%; }
    #lg-wrap .lg-figure-right{ right:-13%; }
    #lg-wrap .lg-logo-wrap{ top:5%; width:72%; }
    #lg-wrap .lg-invite{ top:27%; width:64%; }
    #lg-wrap .lg-form{ width:84%; bottom:6%; }
  }
</style>

<div id="lg-wrap">
  <main class="lg-gate" role="dialog" aria-modal="true" aria-labelledby="lg-title">

    <div class="lg-figure lg-figure-left" aria-hidden="true"></div>
    <div class="lg-figure lg-figure-right" aria-hidden="true"></div>
    <div class="lg-figure-fade" aria-hidden="true"></div>

    <section class="lg-content">

      <div class="lg-logo-wrap">
        <img class="lg-brand-logo" src="/gate/liten-and-co.svg" alt="Liten &amp; Co">
        <div class="lg-brand-rule"></div>
      </div>

      <div class="lg-invite">
        <h1 id="lg-title">You&rsquo;re Invited</h1>
        <p class="lg-soft">Liten &amp; Co is in soft launch.</p>
        <p class="lg-copy">
          We&rsquo;re opening our doors to a select<br>
          group of testers and family.
          <br><br>
          Enter your passcode to explore.
        </p>
      </div>

      <form class="lg-form" method="GET" autocomplete="off">

        <label for="lg-access">PASSCODE</label>

        <div class="lg-input-shell">
          <input id="lg-access" name="access" type="password"
                 placeholder="Enter passcode" autocomplete="current-password">
          <button class="lg-eye" type="button" id="lg-eye"
                  aria-label="Show passcode">&#9673;</button>
        </div>

        <button class="lg-unlock" type="submit">UNLOCK ACCESS</button>

        <p class="lg-err">${wrong ? 'That passcode was not recognised.' : ''}</p>

        <div class="lg-bottom-rule"><span class="lg-leaf">&#10087;</span></div>

        <div class="lg-thanks">
          Thank you for helping us shape something beautiful.
        </div>

      </form>

    </section>
  </main>
</div>

<script>
(function(){
  document.documentElement.classList.add('lg-locked');
  var f = document.getElementById('lg-access');
  var e = document.getElementById('lg-eye');
  if (f){ try{ f.focus(); }catch(_){} }
  if (f && e){
    e.addEventListener('click', function(){
      var hidden = f.type === 'password';
      f.type = hidden ? 'text' : 'password';
      e.innerHTML = hidden ? '\u25CE' : '\u25C9';
      e.setAttribute('aria-label', hidden ? 'Hide passcode' : 'Show passcode');
      f.focus();
    });
  }
})();
</script>
`;
}
