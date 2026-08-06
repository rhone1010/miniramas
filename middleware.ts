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

const ASSET = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|map|json|woff2?|ttf|otf|eot|mp4|webm|txt|xml|bin)$/i;

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const code = process.env.LITEN_ACCESS_CODE;

  /* No code configured -> gate is off entirely. Local dev stays open. */
  if (!code) return route(req, url);

  /* Assets pass ungated: the gate page is fully self-contained, and
     gating images only breaks pages for people already through. */
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
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Manrope:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{ --oxblood:#7d4242; --brass:#75623a; --ink:#2a241e; --vellum:#f4f0e8; }
  *{ box-sizing:border-box; }
  html,body{ height:100%; margin:0; }
  body{
    background:var(--vellum);
    color:var(--ink);
    font-family:'Cormorant Garamond',Georgia,serif;
    display:flex; align-items:center; justify-content:center;
    padding:32px;
  }
  .card{ width:100%; max-width:520px; text-align:center; }
  .mark{
    font-family:'Cormorant Garamond',Georgia,serif;
    font-size:44px; font-weight:500; letter-spacing:.01em;
    margin:0 0 12px;
  }
  .sub{
    font-family:'Manrope',system-ui,sans-serif;
    font-size:12px; letter-spacing:.18em; text-transform:uppercase;
    color:var(--brass); margin:0 0 48px;
  }
  p.lede{ font-size:23px; line-height:1.5; margin:0 0 32px; }
  form{ display:flex; flex-direction:column; gap:16px; align-items:center; }
  input[type=password]{
    width:100%; padding:.7rem 1rem;
    font-family:'Manrope',system-ui,sans-serif; font-size:17px;
    color:var(--ink); background:#fbf9f5;
    border:1px solid rgba(42,36,30,.28); border-radius:999px;
    text-align:center; letter-spacing:.04em;
  }
  input[type=password]:focus{ outline:none; border-color:var(--oxblood); }
  button{
    font-family:'Cormorant Garamond',Georgia,serif; font-style:italic;
    font-size:1.15rem; padding:.55rem 1.6rem;
    color:#fbf9f5; background:var(--oxblood);
    border:none; border-radius:999px; cursor:pointer;
  }
  button:hover{ background:#6b3838; }
  .err{
    font-family:'Manrope',system-ui,sans-serif; font-size:13px;
    color:var(--oxblood); margin:4px 0 0; min-height:1em;
  }
</style>
</head><body>
  <div class="card">
    <h1 class="mark">Liten &amp; Co</h1>
    <p class="sub">By invitation</p>
    <p class="lede">The studio is open to a small number of people before it opens to anyone else.</p>
    <form method="GET" autocomplete="off">
      <input type="password" name="access" placeholder="Access code" autofocus aria-label="Access code">
      <button type="submit">Enter</button>
      <p class="err">${wrong ? 'That code was not recognised.' : ''}</p>
    </form>
  </div>
</body></html>`;
}
