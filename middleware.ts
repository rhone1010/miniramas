import { NextRequest, NextResponse } from 'next/server';

/* ------------------------------------------------------------------ *
 *  Liten & Co — static page routing, doors open
 *
 *  THE WALL IS GONE. Until 25 August this file gated every page behind
 *  the soft-launch passcode: an overlay card, a session cookie, an idle
 *  window, and 270 lines of gate HTML. Rich's ruling that morning:
 *
 *    "I want the site browseable by anyone. so someone CAN skip using
 *     the passcode and have an account, they just start paying
 *     immediately for crafting."
 *
 *  Browse free; account at the moment of intent; the passcode is a
 *  COUPON now, worth 50 credits, checked where it is redeemed — by
 *  /api/v1/invite itself, server-side, since nothing here guards that
 *  endpoint any more. THAT CHECK SHIPS IN THE SAME PR AS THIS FILE:
 *  between the wall dropping and the code check existing, the invite
 *  endpoint would hand 50 credits to anyone who found it.
 *
 *  WHAT THIS FILE STILL DOES, and it is the part that was never about
 *  the gate:
 *
 *  1. Clean URLs. PAGES maps extensionless paths to files in public/.
 *     Unknown paths 404 honestly rather than resolving somewhere wrong.
 *  2. The ?access= courtesy. Old invite links carry the passcode in the
 *     URL. A valid one still records the email and fires the magic link
 *     — the code now travels IN the POST body, because the invite route
 *     checks it — and the URL is scrubbed so the code never sits in an
 *     address bar or a screenshot. An invalid one is simply scrubbed.
 *  3. /logout clears the old gate cookie. The cookie is vestigial, but
 *     browsers still hold it from the gated era, and a logout that
 *     leaves it behind would look like it did nothing.
 *
 *  /api/* is NOT matched, as before. Stripe and Prodigi webhooks must
 *  reach the server unimpeded — gating them means credits never land.
 * ------------------------------------------------------------------ */

const COOKIE = 'liten_access';

/* Extensionless paths -> files in public/. Anything absent 404s
   honestly rather than resolving somewhere wrong. */
const PAGES: Record<string, string> = {
  /* Home is the homepage as of 2026-08-08. The workshop, which used to
     sit at /, keeps /portraits — the masthead and every in-page link
     already point there, so nothing else moves. /home still resolves so
     an old link or bookmark lands somewhere sensible. */
  '/': '/index.html',
  '/home': '/index.html',
  '/portraits': '/portraits.html',
  '/workshop': '/portraits.html',
  /* GROUPS. Same navigation model as Portraits - four rooms where that has
     eight, and everything below the rooms identical. The Series menu on
     both pages links here, so without this line that menu offers a room
     and 404s, which is the exact fault the Portraits menu comment above
     was written about. */
  '/groups': '/groups.html',
  /* PETS AND HALLOWEEN, 21 August. Both files exist and both are wired to
     their own engines -- pets/analyze and pets/generate for one,
     portraits/analyze plus halloween/generate for the other.

     /pets serves the room as built today. It becomes the two-card chooser
     when that exists, at which point this line changes and
     /pets/portraits and /pets/halloween join it. Adding those two now
     would put a room in the Series menu that opens onto nothing, which is
     the fault the Portraits menu comment above was written about. */
  '/pets': '/pets.html',
  /* THE TWO PET ROOMS. Rich ruled /pets becomes a two-card chooser with
     these behind it. Until that exists /pets serves the Portraits room
     directly, so somebody clicking Pets in the menu lands somewhere real
     rather than on an empty stage.

     /pets/portraits is mapped now, ahead of the chooser, so that when the
     chooser lands only the /pets line above changes and both rooms are
     already addressable. Same shape /wallpapers already uses. */
  '/pets/portraits': '/pets.html',
  '/pets/halloween': '/pets-halloween.html',
  '/halloween': '/halloween.html',
  '/gallery': '/gallery.html',
  /* THE BOARD. A page rather than a panel: it is somewhere you go and spend
     time, it wants a URL somebody can send to a friend, and it is the only
     page here that could bring a stranger in. */
  '/community': '/community.html',

  /* MOBILE WALLPAPERS. Exact-match, so every room needs its own line.
     CORRECTED 24 Aug (CUI 42): the craft-room routes pointed back at the
     landing itself, from the era when this was one four-room SPA. Each
     room is its own page now, and the two store catalogues share one
     file that reads its section off the path. */
  '/wallpapers': '/wallpapers.html',
  '/wallpapers/portraits': '/wallpapers-portraits.html',
  '/wallpapers/pets': '/wallpapers-pets.html',
  '/wallpapers/halloween-pets': '/wallpapers-halloween-pets.html',
  '/wallpapers/halloween': '/wallpapers-halloween-pets.html',
  '/wallpapers/store': '/wallpaper-store.html',
  '/wallpapers/store/halloween': '/wallpaper-store.html',
  /* THE ACCORDION AND THE FIELD, merged 19 August. The previous page is
     still in the repo as wallpaper-studio.html and this line is the whole
     way back - point it at the old name and the old Studio returns, with
     no file operation and no deploy of anything but this. */
  /* V002 as of 19 August. V001 shipped with two faults of mine: a
     `.step` grid rule surviving from the old design, which put every
     accordion title in a 98px column and wrapped it one word per line, and
     an `inset:var(--pad)` carried over from a mockup whose grid was padded
     - this one is not, so the mask bands landed in the gutters.

     V001 is still in the repo and this line is still the whole way back. */
  '/wallpapers/studio': '/wallpaper-studio-V002.html',
  /* THE THREE PANELS. My Collection, Account and the Print Shop are
     slide-overs inside portraits.html, not pages of their own. The
     workshop intercepts clicks on its own masthead so they never
     navigate - but the Studio, Community and Gallery all link to them
     as ordinary URLs, and without these three lines every one of those
     links 404s.

     Rewriting here is only half of it. portraits.html has to open the
     panel it was asked for, or this lands somebody on the workshop
     floor wondering where their collection went. See
     scripts/patch-portraits-panel-boot.py. */
  '/collection': '/portraits.html',
  '/account': '/portraits.html',
  '/print': '/portraits.html',
  '/help': '/help.html',
};

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;

  /* Deliberate end of session. Clears the gate-era cookie; sign-out of
     the ACCOUNT is /api/v1/auth/signout and is not this. */
  if (url.pathname === '/logout') {
    const res = NextResponse.redirect(new URL('/', url.origin));
    res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }

  /* The ?access= courtesy for links already in the wild.

     A valid code records the email and fires the magic link exactly as
     the gate used to — but the code goes IN THE BODY now, because
     /api/v1/invite verifies it server-side and a bare email earns
     nothing. Fire and forget: a failure to record must never stop
     somebody reaching a site that is open anyway.

     Valid or not, the parameters are scrubbed and the visit continues.
     An invalid code is not an error page any more — there is no gate to
     bounce off — it is just a link whose coupon did not work, and the
     sign-in card is where they will find that out. */
  const supplied = url.searchParams.get('access');
  if (supplied !== null) {
    const clean = new URL(url.toString());
    clean.searchParams.delete('access');

    const email = (url.searchParams.get('email') || '').trim();
    clean.searchParams.delete('email');

    if (email && email.includes('@')) {
      fetch(new URL('/api/v1/invite', url.origin), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, code: supplied }),
      }).catch(() => {});
    }

    return NextResponse.redirect(clean);
  }

  return route(req, url);
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
