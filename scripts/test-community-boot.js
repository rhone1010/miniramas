/* scripts/test-community-boot.js
 *
 * Boots public/community.html in jsdom with the routes stubbed, and asserts
 * on the DOM that actually results.
 *
 * SYNTAX CHECKING CATCHES NONE OF THE FOUR THINGS THAT KEEP BREAKING THESE
 * PAGES: a duplicate top-level declaration, CSS landing inside a <script>,
 * an override losing on source order, and a positioned element resolving
 * against the wrong ancestor. A harness that boots the page and looks at the
 * result catches the first two outright and makes the others visible.
 *
 *   node scripts/test-community-boot.js
 */

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = path.join(process.cwd(), 'public', 'community.html');

let failures = 0;
function ok(label, cond, detail) {
  if (cond) { console.log('  PASS  ' + label); return; }
  failures++;
  console.log('  FAIL  ' + label + (detail ? '  \u2014 ' + detail : ''));
}

// ---- the fixtures -------------------------------------------------------
// Two posts, one of them the caller's own, so the ownership branch is
// exercised rather than assumed.
const NOW = new Date().toISOString();
const POSTS = {
  ok: true,
  signed_in: true,
  more: true,
  hearted: ['p2'],
  posts: [
    { id: 'p1', effect_id: 'charcoal_chalk', series: 'portraits',
      heart_count: 4, comment_count: 2, handle: 'rich', created_at: NOW,
      image_url: 'https://example.test/p1.jpg' },
    // image_url null on purpose: a card whose signature failed must keep
    // its handle and its counts rather than vanishing off somebody's board.
    { id: 'p2', effect_id: 'bronze', series: 'portraits',
      heart_count: 0, comment_count: 0, handle: 'someone', created_at: NOW,
      image_url: null },
  ],
};

const COMMENTS = {
  ok: true, signed_in: true,
  comments: [
    { id: 'c1', post_id: 'p1', body: 'Lovely.', kind: 'comment',
      built: false, created_at: NOW, handle: 'someone', mine: false },
  ],
};

const IDEAS = {
  ok: true, signed_in: true,
  comments: [
    { id: 'i1', post_id: null, body: 'Do dogs in armour.', kind: 'idea',
      built: true, created_at: NOW, handle: 'someone', mine: false },
  ],
};

function stubFetch(url) {
  const u = String(url);
  const j = (body) => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve(body),
  });
  if (u.indexOf('/api/v1/auth/me') === 0) {
    return j({ user: { id: 'u1', email: 'rich@litenco.com' }, credits: 42 });
  }
  if (u.indexOf('/api/v1/community/handle') === 0) {
    return j({ ok: true, handle: 'rich', suggestion: null, signed_in: true });
  }
  if (u.indexOf('/api/v1/community/comments?ideas=1') === 0) return j(IDEAS);
  if (u.indexOf('/api/v1/community/comments?post=') === 0) return j(COMMENTS);
  if (u.indexOf('/api/v1/community/posts') === 0) return j(POSTS);
  return j({ ok: true });
}

// ---- boot ---------------------------------------------------------------
(async function () {
  if (!fs.existsSync(FILE)) {
    console.error('MISSING: ' + FILE);
    process.exit(1);
  }
  const html = fs.readFileSync(FILE, 'utf8');

  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));

  // EVERYTHING THE PAGE NEEDS IS INSTALLED BEFORE PARSE. The inline scripts
  // run at their position in the document, so anything supplied afterwards
  // is supplied too late \u2014 and re-running the scripts to compensate
  // double-binds every listener and tests a page nobody will ever load.
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://litenco.com/community',
    virtualConsole: vc,
    beforeParse(w) {
      w.fetch = stubFetch;
      w.confirm = () => true;
      // effect-registry.js is a <script src> jsdom will not fetch. Supplied
      // here in the shape scripts/emit-effect-registry.js produces.
      w.EFFECT_REGISTRY = {
        silos: [{ id: 'portraits', label: 'Portraits', line: '' }],
        effects: [
          { id: 'charcoal_chalk', label: 'Charcoal & Chalk', category: 'portraits', body: 'live' },
          { id: 'bronze',         label: 'Bronze',           category: 'portraits', body: 'live' },
        ],
      };
    },
  });

  const w = dom.window;
  const d = w.document;

  await new Promise((r) => setTimeout(r, 120));

  console.log('\ncommunity.html \u00b7 boot\n');

  ok('no jsdom errors', errors.length === 0, errors.join(' | '));

  // ---- THE SHELL --------------------------------------------------------
  ok('masthead present', !!d.getElementById('masthead'));
  ok('the ground is present', !!d.querySelector('.ground'));
  ok('nav marks Community', (() => {
    const a = d.querySelector('.mh-nav a[href="/community"]');
    return !!a && a.classList.contains('on');
  })());
  ok('nav carries all five entries', (() => {
    const want = ['/gallery', '/community', '/collection', '/account'];
    return want.every((h) => !!d.querySelector('.mh-nav a[href="' + h + '"]'))
      && !!d.getElementById('mhSeriesBtn');
  })());

  // The fault that killed a whole page once: an anchor put CSS inside a
  // <script>. If any style rule ends up in script text, this catches it.
  ok('no CSS inside a script block', (() => {
    return !Array.prototype.some.call(
      d.querySelectorAll('script:not([src])'),
      (s) => /^\s*\.[a-zA-Z][\w-]*\s*\{/m.test(s.textContent)
    );
  })());

  // ---- THE WALL ---------------------------------------------------------
  const cards = d.querySelectorAll('#wallCols .pc');
  ok('two cards drawn', cards.length === 2, 'got ' + cards.length);
  ok('first card has its image', !!d.querySelector('#wallCols .pc img'));
  ok('a card with no signed URL still draws', (() => {
    const c = d.querySelector('.pc[data-post-id="p2"]');
    return !!c && !!c.querySelector('.pc-gap') && /someone/.test(c.textContent);
  })());
  ok('effect label comes from the registry',
    /Charcoal & Chalk/.test(d.querySelector('.pc[data-post-id="p1"]').textContent));
  ok('own post is marked yours',
    /yours/.test(d.querySelector('.pc[data-post-id="p1"]').textContent));
  ok('show-more is offered when more is true',
    d.getElementById('wallMore').hidden === false);

  // ---- ONE POST ---------------------------------------------------------
  d.querySelector('.pc[data-post-id="p1"]').dispatchEvent(
    new w.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));

  ok('the post panel opens',
    d.getElementById('post').classList.contains('is-open'));
  ok('withdraw is offered on my own piece',
    d.getElementById('postWithdraw').hidden === false);
  ok('report is hidden on my own piece',
    d.getElementById('postReport').hidden === true);
  ok('the comment loaded', /Lovely\./.test(d.getElementById('postCmts').textContent));
  ok('a comment under my own piece can be removed',
    !!d.querySelector('#postCmts [data-rm]'));
  ok('the writer is open, handle already set',
    d.getElementById('cmtSay').hidden === false
    && d.getElementById('cmtHandle').hidden === true);

  // ---- IDEAS ------------------------------------------------------------
  d.getElementById('vIdeas').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));

  ok('ideas view shows', d.getElementById('ideas').hidden === false
    && d.getElementById('wall').hidden === true);
  ok('the show-more button hides with the wall',
    d.getElementById('wallMore').hidden === true);
  ok('an idea drew, with its Built mark',
    /armour/.test(d.getElementById('ideaList').textContent)
    && !!d.querySelector('.idea-built'));

  d.getElementById('vBoard').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));
  ok('show-more comes back with the wall',
    d.getElementById('wallMore').hidden === false);

  // ---- THE CONCIERGE ----------------------------------------------------
  ok('concierge points published', Array.isArray(w.CONCIERGE_POINTS)
    && w.CONCIERGE_POINTS.length > 0);
  ok('every concierge target exists on this page', (() => {
    return w.CONCIERGE_POINTS.every((p) => !!d.querySelector(p.sel));
  })());

  console.log('\n' + (failures ? failures + ' FAILED' : 'all passed') + '\n');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error('harness threw:', e && e.message);
  process.exit(1);
});
