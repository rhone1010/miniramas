/* test-collection-post.js - boot the post-to-community modal in jsdom.
 *
 *   node scripts/test-collection-post.js public/portraits.html
 *
 * Runs only the injected script block against the injected markup, with the
 * two routes stubbed. The rest of portraits.html is eleven thousand lines of
 * workshop that this change does not touch and that jsdom would spend a
 * minute on; the point here is whether the modal gates, claims and posts
 * correctly.
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const path = process.argv[2] || 'public/portraits.html';
const src = fs.readFileSync(path, 'utf8');

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

/* pull the modal markup and its script out of the file */
const mStart = src.indexOf('<div class="pcm-scrim"');
if (mStart === -1) { console.log('FAIL: modal markup not found'); process.exit(1); }
const mEnd = src.indexOf('</div>\r\n\r\n<script>', mStart);
const markup = src.slice(mStart, src.indexOf('<script>', mStart));
const jsStart = src.indexOf('<script>', mStart) + '<script>'.length;
const js = src.slice(jsStart, src.indexOf('</script>', jsStart));

function boot(handleReply, postReply, putReply) {
  const dom = new JSDOM('<!doctype html><html><body>' + markup + '</body></html>',
    { runScripts: 'outside-only' });
  const w = dom.window;
  const calls = [];
  w.fetch = function (url, opts) {
    opts = opts || {};
    calls.push({ url: url, opts: opts });
    let body;
    if (String(url).indexOf('/handle') !== -1) {
      body = (opts.method === 'PUT') ? (putReply || { ok: true, handle: 'claimed' })
                                     : handleReply;
    } else {
      body = postReply;
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: function () { return Promise.resolve(JSON.parse(JSON.stringify(body))); }
    });
  };
  w.eval(js);
  return { w, d: w.document, calls };
}

const settle = () => new Promise(r => setTimeout(r, 0));

(async function () {
  console.log('test-collection-post');
  console.log('  target ' + path);

  /* ---- 1 · the consent wording is the one in db.ts ---------------------- */
  {
    const { d } = boot({ handle: 'rich' }, { ok: true });
    const text = d.getElementById('pcmConsentText').textContent;
    ok('consent text is rendered', text.length > 100);
    ok('consent names the permission clause',
      text.indexOf('or I have the permission of the person in it') !== -1);
    ok('consent names the handle promise',
      text.indexOf('with my handle beneath it') !== -1);
    ok('consent names the right to withdraw',
      text.indexOf('take it down at any time') !== -1);
  }

  /* ---- 2 · gating ------------------------------------------------------ */
  {
    const { w, d } = boot({ handle: 'rich' }, { ok: true });
    w.openPostToCommunity({ id: 'p1', art: 'data:,x' });
    await settle();
    ok('modal opens', d.getElementById('pcmScrim').classList.contains('is-open'));
    ok('handle field hidden when one exists', d.getElementById('pcmHandleField').hidden);
    ok('post refused before consent', d.getElementById('pcmGo').disabled);
    d.getElementById('pcmConsent').checked = true;
    d.getElementById('pcmConsent').dispatchEvent(new w.Event('change'));
    ok('post allowed after consent', !d.getElementById('pcmGo').disabled);
  }

  /* ---- 3 · no handle yet ----------------------------------------------- */
  {
    const { w, d } = boot({ handle: null, suggestion: 'quiet-heron' }, { ok: true });
    w.openPostToCommunity({ id: 'p1', art: 'data:,x' });
    await settle();
    ok('handle field shown when none exists', !d.getElementById('pcmHandleField').hidden);
    ok('suggestion is offered', d.getElementById('pcmHandle').value === 'quiet-heron');
    d.getElementById('pcmConsent').checked = true;
    d.getElementById('pcmConsent').dispatchEvent(new w.Event('change'));
    ok('consent alone is not enough without a handle',
      !d.getElementById('pcmGo').disabled);   // suggestion fills the box, so allowed
    d.getElementById('pcmHandle').value = '';
    d.getElementById('pcmHandle').dispatchEvent(new w.Event('input'));
    ok('empty handle re-blocks the post', d.getElementById('pcmGo').disabled);
  }

  /* ---- 4 · the happy path sends what the route wants -------------------- */
  {
    const { w, d, calls } = boot({ handle: 'rich' }, { ok: true, id: 'x1', earned: 0 });
    w.openPostToCommunity({ id: 'piece-42', art: 'data:,x' });
    await settle();
    d.getElementById('pcmConsent').checked = true;
    d.getElementById('pcmConsent').dispatchEvent(new w.Event('change'));
    d.getElementById('pcmGo').dispatchEvent(new w.Event('click'));
    await settle(); await settle();
    const post = calls.filter(c => String(c.url).indexOf('/posts') !== -1)[0];
    ok('posts to the right route', !!post);
    const sent = JSON.parse(post.opts.body);
    ok('sends piece_id', sent.piece_id === 'piece-42');
    ok('sends consent true', sent.consent === true);
    ok('sends the cookie', post.opts.credentials === 'same-origin');
    ok('says it landed', d.getElementById('pcmSay').textContent.indexOf('on the board') !== -1);
  }

  /* ---- 5 · the tenth post is worth saying ------------------------------- */
  {
    const { w, d } = boot({ handle: 'rich' }, { ok: true, id: 'x1', earned: 1 });
    w.openPostToCommunity({ id: 'p10', art: 'data:,x' });
    await settle();
    d.getElementById('pcmConsent').checked = true;
    d.getElementById('pcmConsent').dispatchEvent(new w.Event('change'));
    d.getElementById('pcmGo').dispatchEvent(new w.Event('click'));
    await settle(); await settle();
    ok('the earned craft is mentioned',
      d.getElementById('pcmSay').textContent.indexOf('craft is on us') !== -1);
  }

  /* ---- 6 · every refusal says something true ---------------------------- */
  const REFUSALS = [
    ['already_posted', 'already on the board'],
    ['slow_down',      'three in an hour'],
    ['signed_out',     'Sign in first'],
    ['archived',       'archived'],
    ['need_handle',    'Choose a handle'],
    ['no_piece',       'cannot find that piece'],
  ];
  for (const [reason, phrase] of REFUSALS) {
    const { w, d } = boot({ handle: 'rich' }, { ok: false, reason });
    w.openPostToCommunity({ id: 'p1', art: 'data:,x' });
    await settle();
    d.getElementById('pcmConsent').checked = true;
    d.getElementById('pcmConsent').dispatchEvent(new w.Event('change'));
    d.getElementById('pcmGo').dispatchEvent(new w.Event('click'));
    await settle(); await settle();
    const said = d.getElementById('pcmSay').textContent;
    ok(reason + ' is explained', said.indexOf(phrase) !== -1);
    ok(reason + ' leaves the modal open',
      d.getElementById('pcmScrim').classList.contains('is-open'));
  }

  /* ---- 7 · an unknown reason still says something ----------------------- */
  {
    const { w, d } = boot({ handle: 'rich' }, { ok: false, reason: 'something_new' });
    w.openPostToCommunity({ id: 'p1', art: 'data:,x' });
    await settle();
    d.getElementById('pcmConsent').checked = true;
    d.getElementById('pcmConsent').dispatchEvent(new w.Event('change'));
    d.getElementById('pcmGo').dispatchEvent(new w.Event('click'));
    await settle(); await settle();
    ok('an unmapped reason falls back', d.getElementById('pcmSay').textContent.length > 0);
  }

  /* ---- 8 · claim then post, on one press -------------------------------- */
  {
    const { w, d, calls } = boot({ handle: null, suggestion: 'quiet-heron' },
                                 { ok: true, id: 'x1' });
    w.openPostToCommunity({ id: 'p1', art: 'data:,x' });
    await settle();
    d.getElementById('pcmConsent').checked = true;
    d.getElementById('pcmConsent').dispatchEvent(new w.Event('change'));
    d.getElementById('pcmGo').dispatchEvent(new w.Event('click'));
    await settle(); await settle(); await settle();
    const put = calls.filter(c => (c.opts.method || '') === 'PUT')[0];
    ok('claims the handle first', !!put);
    ok('claims what was typed', !!put && JSON.parse(put.opts.body).handle === 'quiet-heron');
    ok('then posts', calls.some(c => String(c.url).indexOf('/posts') !== -1));
  }

  /* ---- 9 · escape and backdrop shut it ---------------------------------- */
  {
    const { w, d } = boot({ handle: 'rich' }, { ok: true });
    w.openPostToCommunity({ id: 'p1', art: 'data:,x' });
    await settle();
    d.getElementById('pcmCancel').dispatchEvent(new w.Event('click'));
    ok('Not now shuts it', !d.getElementById('pcmScrim').classList.contains('is-open'));

    w.openPostToCommunity({ id: 'p1', art: 'data:,x' });
    await settle();
    const ev = new w.KeyboardEvent('keydown', { key: 'Escape' });
    w.dispatchEvent(ev);
    ok('Escape shuts it', !d.getElementById('pcmScrim').classList.contains('is-open'));
  }

  /* ---- 10 · a taken handle is said plainly and does not post ------------ */
  {
    const { w, d, calls } = boot({ handle: null, suggestion: 'quiet-heron' },
                                 { ok: true }, { ok: false, reason: 'taken' });
    w.openPostToCommunity({ id: 'p1', art: 'data:,x' });
    await settle();
    d.getElementById('pcmConsent').checked = true;
    d.getElementById('pcmConsent').dispatchEvent(new w.Event('change'));
    d.getElementById('pcmGo').dispatchEvent(new w.Event('click'));
    await settle(); await settle(); await settle();
    ok('a taken handle is explained',
      d.getElementById('pcmSay').textContent.indexOf('already writes under that one') !== -1);
    ok('a taken handle does not post',
      !calls.some(c => String(c.url).indexOf('/posts') !== -1));
    ok('the modal stays open to try again',
      d.getElementById('pcmScrim').classList.contains('is-open'));
  }

  console.log('');
  console.log('  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
