import { NextRequest, NextResponse } from 'next/server';

/* ------------------------------------------------------------------ *
 *  Liten & Co — soft-launch access gate + static page routing
 *
 *  1. Gate: one code, one cookie, 30 days.
 *  2. Routing: /portraits -> /portraits.html (no next.config.js change).
 *
 *  /api/* is NOT matched. Stripe and Prodigi webhooks must reach the
 *  server without a cookie — gating them means credits never land.
 * ------------------------------------------------------------------ */

const COOKIE = 'liten_access';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/* Extensionless paths -> files in public/. Anything absent 404s
   honestly rather than resolving somewhere wrong. */
const PAGES: Record<string, string> = {
  '/portraits': '/portraits.html',
  '/wallpapers': '/portrait-wallpaper.html',
  '/portrait-wallpaper': '/portrait-wallpaper.html',
  '/pet-wallpaper': '/pet-wallpaper.html',
};

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

const ASSET =
  /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|map|json|woff2?|ttf|otf|eot|mp4|webm|txt|xml|bin)$/i;

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const code = process.env.LITEN_ACCESS_CODE;

  /* No code configured -> gate is off entirely. Local dev stays open. */
  if (!code) return route(req, url);

  /* Assets pass ungated: the gate page needs its own figures and mark,
     and gating images only breaks pages for people already through. */
  if (ASSET.test(url.pathname)) return NextResponse.next();

  /* Correct code supplied -> set cookie, redirect to the clean URL so
     the code never sits in the address bar or a shared screenshot. */
  const supplied = url.searchParams.get('access');
  if (supplied !== null && supplied === code) {
    const clean = new URL(url.toString());
    clean.searchParams.delete('access');
    const res = NextResponse.redirect(clean);
    res.cookies.set(COOKIE, code, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: MAX_AGE,
      path: '/',
    });
    return res;
  }

  /* Already through. */
  if (req.cookies.get(COOKIE)?.value === code) return route(req, url);

  /* Otherwise: the gate. 401 so it is never cached as the real page. */
  return new NextResponse(gate(supplied !== null), {
    status: 401,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function route(req: NextRequest, url: URL) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const target = PAGES[path];
  if (target) return NextResponse.rewrite(new URL(target, url));
  return NextResponse.next();
}

function gate(wrong: boolean) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Liten &amp; Co</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --oxblood:#7d4242;
    --brass:#75623a;
    --ink:#2a241e;
    --card:#e9e1d3;
    --card-hi:#f2ebdf;
  }
  *{ box-sizing:border-box; }
  html,body{ height:100%; margin:0; }
  body{
    background:#1c1613;
    background-image:
      radial-gradient(120% 90% at 50% 30%, rgba(96,74,56,.42) 0%, rgba(28,22,19,0) 62%);
    color:var(--ink);
    font-family:'Cormorant Garamond',Georgia,serif;
    display:flex; align-items:center; justify-content:center;
    padding:40px 24px;
  }

  .card{
    position:relative;
    width:100%; max-width:880px;
    background:linear-gradient(170deg,var(--card-hi) 0%,var(--card) 46%,#e4dbca 100%);
    border-radius:18px;
    overflow:hidden;
    box-shadow:0 40px 90px rgba(0,0,0,.55);
    padding:56px 48px 44px;
  }
  /* subtle stone grain, no paper/leather/wood */
  .card::before{
    content:''; position:absolute; inset:0; pointer-events:none;
    background-image:radial-gradient(rgba(42,36,30,.045) 1px, transparent 1px);
    background-size:3px 3px;
  }

  /* --- figures ------------------------------------------------- */
  .fig{
    position:absolute; bottom:0; height:78%; width:auto;
    pointer-events:none; user-select:none;
  }
  .fig-w{
    left:0;
    -webkit-mask-image:linear-gradient(to right,#000 46%,transparent 96%);
            mask-image:linear-gradient(to right,#000 46%,transparent 96%);
  }
  .fig-m{
    right:0;
    -webkit-mask-image:linear-gradient(to left,#000 46%,transparent 96%);
            mask-image:linear-gradient(to left,#000 46%,transparent 96%);
  }
  /* fades the figures down into the lower half of the card */
  .fade{
    position:absolute; left:0; right:0; bottom:0; height:46%;
    background:linear-gradient(to bottom,rgba(233,225,211,0) 0%,#e7dfd0 62%,#e4dbca 100%);
    pointer-events:none; z-index:2;
  }

  /* --- content ------------------------------------------------- */
  .inner{ position:relative; z-index:3; text-align:center; }
  .mark{ display:block; margin:0 auto 22px; width:264px; max-width:62%; height:auto; }

  .rule{
    display:flex; align-items:center; justify-content:center; gap:14px;
    margin:0 auto 40px; max-width:340px;
  }
  .rule i{ flex:1; height:1px; background:rgba(117,98,58,.42); }
  .rule span{ color:var(--brass); font-size:11px; line-height:1; }

  h1{
    font-family:'Cormorant Garamond',Georgia,serif;
    font-weight:500; font-size:52px; line-height:1.1;
    margin:0 0 16px; letter-spacing:.005em;
  }
  .lede{
    font-style:italic; font-size:26px; line-height:1.4;
    color:var(--oxblood); margin:0 0 30px;
  }
  p.body{
    font-size:23px; line-height:1.55; margin:0 auto 20px; max-width:26em;
  }

  /* --- form ---------------------------------------------------- */
  form{ margin:52px auto 0; max-width:600px; text-align:left; }
  label{
    display:block;
    font-family:'Manrope',system-ui,sans-serif;
    font-size:12px; font-weight:600; letter-spacing:.2em;
    text-transform:uppercase; color:var(--brass);
    margin:0 0 10px 4px;
  }
  .field{ position:relative; }
  input[type=password],input[type=text]{
    width:100%; padding:.85rem 3.2rem .85rem 1.3rem;
    font-family:'Cormorant Garamond',Georgia,serif; font-size:22px;
    color:var(--ink); background:#f6f1e7;
    border:1px solid rgba(117,98,58,.38); border-radius:12px;
  }
  input::placeholder{ color:rgba(42,36,30,.42); }
  input:focus{ outline:none; border-color:var(--oxblood); }
  .eye{
    position:absolute; top:50%; right:14px; transform:translateY(-50%);
    background:none; border:none; cursor:pointer; padding:6px;
    color:var(--brass); line-height:0;
  }
  button.go{
    display:block; width:100%; margin:18px 0 0;
    font-family:'Manrope',system-ui,sans-serif;
    font-size:15px; font-weight:600; letter-spacing:.16em; text-transform:uppercase;
    color:#f3ece0; background:#3a2a22;
    border:none; border-radius:12px; padding:1.05rem 1rem; cursor:pointer;
  }
  button.go:hover{ background:var(--oxblood); }
  .err{
    font-family:'Manrope',system-ui,sans-serif; font-size:13px;
    color:var(--oxblood); margin:12px 0 0; min-height:1.2em; text-align:center;
  }

  .foot{ margin-top:34px; text-align:center; }
  .foot .rule{ margin-bottom:16px; }
  .foot p{
    font-style:italic; font-size:21px; color:rgba(42,36,30,.7); margin:0;
  }

  @media (max-width:820px){
    .fig{ display:none; }
    .card{ padding:44px 26px 36px; }
    h1{ font-size:40px; }
    .lede{ font-size:23px; }
    p.body{ font-size:21px; }
  }
</style>
</head><body>
  <div class="card">
    <img class="fig fig-w" src="/gate/gate_woman_image.png" alt="">
    <img class="fig fig-m" src="/gate/gate_man_image.png" alt="">
    <div class="fade"></div>

    <div class="inner">
      <img class="mark" src="/gate/liten-and-co.svg" alt="Liten &amp; Co">

      <div class="rule"><i></i><span>&#9670;</span><i></i></div>

      <h1>You&rsquo;re Invited</h1>
      <p class="lede">Liten &amp; Co is in soft launch.</p>
      <p class="body">We&rsquo;re opening our doors to a select group of testers and family.</p>
      <p class="body">Enter your passcode to explore.</p>

      <form method="GET" autocomplete="off">
        <label for="access">Passcode</label>
        <div class="field">
          <input id="access" type="password" name="access" placeholder="Enter passcode" autofocus>
          <button type="button" class="eye" id="eye" aria-label="Show passcode">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z"/>
              <circle cx="12" cy="12" r="3.2"/>
            </svg>
          </button>
        </div>
        <button type="submit" class="go">Unlock Access</button>
        <p class="err">${wrong ? 'That passcode was not recognised.' : ''}</p>
      </form>

      <div class="foot">
        <div class="rule"><i></i><span>&#10047;</span><i></i></div>
        <p>Thank you for helping us shape something beautiful.</p>
      </div>
    </div>
  </div>

<script>
(function(){
  var f = document.getElementById('access');
  var e = document.getElementById('eye');
  if(!f || !e) return;
  e.addEventListener('click', function(){
    var showing = f.type === 'text';
    f.type = showing ? 'password' : 'text';
    e.setAttribute('aria-label', showing ? 'Show passcode' : 'Hide passcode');
    f.focus();
  });
})();
</script>
</body></html>`;
}
