/* public/concierge.js
 *
 * THE CONCIERGE, EVERYWHERE.
 *
 * One implementation, loaded by every page that wants her. She used to
 * live inside help.html; a second copy in the workshop would be two
 * panels to keep in step, and the first time they drifted the customer
 * would meet two different people.
 *
 * TO PUT HER ON A PAGE
 *     <script src="/concierge.js" defer></script>
 * and give something a data-concierge attribute. Any element works — a
 * button in a masthead, a tab in a bottom bar, a pill in a section bar.
 * She styles herself and cleans up after herself.
 *
 * WHAT SHE CAN DO
 *     Answer questions. That is all, and she says so. She cannot see an
 *     account, cannot issue credits, cannot refund. When somebody needs
 *     something done she takes a message, which goes to hello@litenco.com
 *     through /api/v1/support — the row is written before the mail is
 *     sent, so nothing a customer typed is lost to a bounce.
 *
 * WHY NOT GIVE HER THE ACCOUNT
 *     Because the guardrails are not built. A model with an unbounded
 *     refund tool eventually meets a conversation that talks it past a
 *     rule written in prose, and the limits have to live in the tool
 *     rather than the prompt. Until then she hands off cleanly, which is
 *     honest, rather than half-helping, which is not.
 *     See docs/GOVERNANCE/CONCIERGE-GUIDANCE-2026-08-08.md.
 */
(function () {
  'use strict';

  if (window.__conciergeReady) return;
  window.__conciergeReady = true;

  var SAGE = '#4a6b4a';
  var history = [];
  var busy = false;
  var veil = null, log = null, input = null, send = null, seeds = null;
  var mode = 'ask';          /* 'ask' | 'message' | 'sent' */

  /* ── STYLE ──────────────────────────────────────────────────────────
     Injected rather than required in a stylesheet, so a page adopts her
     with one script tag and nothing else. Every rule is scoped under
     .cx- : this drops into a 10,000-line workshop with its own :root and
     its own box-sizing, and an unscoped rule here would reach into it. */
  var css = [
    '.cx-veil{position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;',
      'padding:4vh 4vw;background:rgba(30,24,18,.52);backdrop-filter:blur(3px);',
      'font-size:16px}',
    '.cx-veil *{box-sizing:border-box}',
    '.cx-veil[hidden]{display:none}',

    '.cx{width:min(620px,100%);max-height:86vh;display:flex;flex-direction:column;',
      'background:#f8f4eb;border:1px solid rgba(74,107,74,.22);border-radius:14px;',
      'box-shadow:0 30px 80px rgba(0,0,0,.34);overflow:hidden}',

    '.cx-hd{display:flex;align-items:center;gap:.7em;flex:0 0 auto;padding:1em 1.15em;',
      'background:rgba(74,107,74,.07);border-bottom:1px solid rgba(74,107,74,.22)}',
    '.cx-dot{width:9px;height:9px;border-radius:50%;background:' + SAGE + ';flex:none}',
    '.cx-hd b{font-family:Georgia,serif;font-weight:400;font-style:italic;',
      'font-size:1.35em;color:' + SAGE + '}',
    '.cx-x{margin-left:auto;font-size:1.6em;line-height:1;color:#aba39a;',
      'background:none;border:none;padding:.1em .35em;cursor:pointer}',
    '.cx-x:hover{color:#2a241e}',

    '.cx-log{flex:1 1 auto;min-height:170px;overflow-y:auto;padding:1.15em;',
      'display:flex;flex-direction:column;gap:.85em}',
    '.cx-msg{max-width:86%;font-family:Georgia,serif;font-size:1.12em;line-height:1.45}',
    '.cx-msg.you{align-self:flex-end;background:#e9dec8;color:#2a241e;',
      'padding:.75em 1em;border-radius:14px 14px 4px 14px}',
    '.cx-msg.con{align-self:flex-start;color:#2a241e;background:#fff;',
      'border:1px solid rgba(74,107,74,.22);padding:.75em 1em;border-radius:14px 14px 14px 4px}',
    '.cx-msg.con b{display:block;font-family:system-ui,Arial,sans-serif;font-size:.62em;',
      'font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:' + SAGE + ';',
      'margin-bottom:.4em}',
    '.cx-msg.err{align-self:flex-start;color:#7d4242;font-style:italic;padding:.3em 0}',

    '.cx-dots{display:inline-flex;gap:4px;align-items:center;height:1.3em}',
    '.cx-dots i{width:5px;height:5px;border-radius:50%;background:' + SAGE + ';',
      'opacity:.35;animation:cxBlink 1.1s infinite}',
    '.cx-dots i:nth-child(2){animation-delay:.18s}',
    '.cx-dots i:nth-child(3){animation-delay:.36s}',
    '@keyframes cxBlink{0%,100%{opacity:.25}50%{opacity:.9}}',

    '.cx-seeds{display:flex;flex-wrap:wrap;gap:.45em;padding:0 1.15em 1em;flex:0 0 auto}',
    '.cx-seeds button{font-family:Georgia,serif;font-style:italic;font-size:.98em;',
      'color:' + SAGE + ';background:none;padding:.4em 1em;cursor:pointer;',
      'border:1px solid rgba(74,107,74,.22);border-radius:999px}',
    '.cx-seeds button:hover{background:rgba(74,107,74,.07)}',

    '.cx-ask{display:flex;gap:.6em;flex:0 0 auto;padding:.9em 1.15em;',
      'border-top:1px solid rgba(74,107,74,.22)}',
    '.cx-ask input,.cx-ask textarea{flex:1 1 auto;min-width:0;padding:.85em 1em;',
      'font-family:Georgia,serif;font-size:1.12em;color:#2a241e;background:#fff;',
      'border:1px solid rgba(74,107,74,.22);border-radius:14px;outline:none;resize:none}',
    '.cx-ask input{height:3.2em;border-radius:999px;padding:0 1em}',
    '.cx-ask input::placeholder,.cx-ask textarea::placeholder{color:#aba39a}',
    '.cx-ask input:focus,.cx-ask textarea:focus{border-color:' + SAGE + '}',
    '.cx-send{flex:none;padding:0 1.6em;border-radius:999px;border:none;cursor:pointer;',
      'background:' + SAGE + ';color:#f8f4eb;font-family:Georgia,serif;font-style:italic;',
      'font-size:1.12em}',
    '.cx-send:hover{background:#5d7d5d}',
    '.cx-send:disabled{opacity:.45;cursor:default}',

    '.cx-foot{flex:0 0 auto;padding:0 1.15em 1em;font-family:Georgia,serif;',
      'font-style:italic;font-size:.98em;color:#aba39a}',
    '.cx-foot a{color:' + SAGE + '}',
    '.cx-hand{align-self:flex-start;margin-top:.2em}',
    '.cx-hand button{font-family:Georgia,serif;font-style:italic;font-size:1em;',
      'color:#f8f4eb;background:' + SAGE + ';border:none;cursor:pointer;',
      'padding:.55em 1.3em;border-radius:999px}',
    '.cx-hand button:hover{background:#5d7d5d}',

    '@media (max-width:600px){',
      '.cx-veil{padding:0}',
      '.cx{width:100%;height:100%;max-height:100vh;border:none;border-radius:0}',
      '.cx-ask{flex-wrap:wrap;padding-bottom:calc(.9em + env(safe-area-inset-bottom))}',
      '.cx-send{width:100%;padding:.85em 0}',
    '}',
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ── PANEL ──────────────────────────────────────────────────────── */
  function build() {
    veil = document.createElement('div');
    veil.className = 'cx-veil';
    veil.innerHTML =
      '<div class="cx" role="dialog" aria-modal="true" aria-label="The Concierge">' +
        '<div class="cx-hd">' +
          '<span class="cx-dot"></span><b>The Concierge</b>' +
          '<button class="cx-x" type="button" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="cx-log" role="log" aria-live="polite"></div>' +
        '<div class="cx-seeds"></div>' +
        '<div class="cx-ask">' +
          '<input type="text" placeholder="Ask a question" autocomplete="off" ' +
                 'aria-label="Ask the Concierge">' +
          '<button class="cx-send" type="button">Ask</button>' +
        '</div>' +
        '<p class="cx-foot"></p>' +
      '</div>';
    document.body.appendChild(veil);

    log   = veil.querySelector('.cx-log');
    input = veil.querySelector('.cx-ask input');
    send  = veil.querySelector('.cx-send');
    seeds = veil.querySelector('.cx-seeds');

    veil.querySelector('.cx-x').addEventListener('click', close);
    veil.addEventListener('click', function (e) { if (e.target === veil) close(); });
    send.addEventListener('click', function () { submit(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    seeds.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) ask(b.textContent);
    });

    greet();
  }

  function greet() {
    bubble('con',
      'Good day. Ask me anything about how Liten & Co works \u2014 finishes, ' +
      'photographs, prints, what becomes of your picture. I can answer ' +
      'questions, though I cannot look at your account.');

    seeds.innerHTML = '';
    ['What makes a good photograph?',
     'How long does a craft take?',
     'What happens to my picture?'].forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = t;
      seeds.appendChild(b);
    });

    foot('For anything to do with your own account, I can take a message.');
  }

  function foot(html) {
    var f = veil.querySelector('.cx-foot');
    f.innerHTML = html;
  }

  function open() {
    if (!veil) build();
    veil.hidden = false;
    setTimeout(function () { input.focus(); }, 40);
  }
  function close() { if (veil) veil.hidden = true; }

  addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  /* Any element with data-concierge opens her. Delegated, so a trigger
     drawn by script after this file ran still works. */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-concierge]');
    if (!t) return;
    e.preventDefault();
    open();
  });
  window.__openConcierge = open;

  /* ── MESSAGES ───────────────────────────────────────────────────── */
  function bubble(who, text) {
    var d = document.createElement('div');
    d.className = 'cx-msg ' + who;
    if (who === 'con') {
      var b = document.createElement('b');
      b.textContent = 'Concierge';
      d.appendChild(b);
      d.appendChild(document.createTextNode(text));
    } else {
      d.textContent = text;
    }
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function err(text) {
    var d = document.createElement('div');
    d.className = 'cx-msg err';
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  function submit() {
    if (mode === 'message') return leaveMessage(input.value);
    ask(input.value);
  }

  function ask(text) {
    text = String(text || '').trim();
    if (!text || busy) return;

    busy = true;
    send.disabled = true;
    input.value = '';
    if (seeds) seeds.innerHTML = '';

    bubble('you', text);
    history.push({ role: 'user', content: text });

    var wait = document.createElement('div');
    wait.className = 'cx-msg con';
    wait.innerHTML = '<b>Concierge</b><span class="cx-dots"><i></i><i></i><i></i></span>';
    log.appendChild(wait);
    log.scrollTop = log.scrollHeight;

    fetch('/api/v1/concierge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-20) }),
    })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (d) {
        wait.remove();
        if (d && d.ok && d.reply) {
          bubble('con', d.reply);
          history.push({ role: 'assistant', content: d.reply });
          offerHandoff();
        } else {
          err('I could not reach the desk just then. Try again in a moment, ' +
              'or write to hello@litenco.com.');
        }
      })
      .catch(function () {
        wait.remove();
        err('I could not reach the desk just then. Try again in a moment.');
      })
      .then(function () {
        busy = false;
        send.disabled = false;
        input.focus();
      });
  }

  /* THE HANDOFF. Offered once, after she has actually said something —
     a "leave a message" button sitting there from the first paint tells
     somebody with a simple question that she is not going to answer it. */
  var handedOff = false;
  function offerHandoff() {
    if (handedOff || history.length < 2) return;
    handedOff = true;

    var wrap = document.createElement('div');
    wrap.className = 'cx-hand';
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Leave a message instead';
    wrap.appendChild(b);
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;

    b.addEventListener('click', function () {
      wrap.remove();
      startMessage();
    });
  }

  function startMessage() {
    mode = 'message';
    bubble('con',
      'Of course. Write what you need and I will pass it to the studio \u2014 ' +
      'somebody reads every one of these, and you will hear back at the ' +
      'address on your account.');

    var ask = veil.querySelector('.cx-ask');
    ask.innerHTML =
      '<textarea rows="4" placeholder="What do you need?" ' +
        'aria-label="Your message"></textarea>' +
      '<button class="cx-send" type="button">Send</button>';

    input = ask.querySelector('textarea');
    send  = ask.querySelector('.cx-send');
    send.addEventListener('click', function () { leaveMessage(input.value); });
    input.focus();

    foot('Goes to hello@litenco.com.');
  }

  function leaveMessage(text) {
    text = String(text || '').trim();
    if (text.length < 5 || busy) return;

    busy = true;
    send.disabled = true;
    input.value = '';
    bubble('you', text);

    var wait = document.createElement('div');
    wait.className = 'cx-msg con';
    wait.innerHTML = '<b>Concierge</b><span class="cx-dots"><i></i><i></i><i></i></span>';
    log.appendChild(wait);

    /* Whatever the page knows. It costs the customer nothing and saves
       Rich a round trip asking where they were and what they had. */
    var ctx = { page: location.pathname };
    try {
      if (window.__creditBalance !== undefined) ctx.credits = window.__creditBalance;
    } catch (e) {}

    fetch('/api/v1/support', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: text,
        subject: 'A message from the workshop',
        context: ctx,
        /* The transcript so far, so nobody has to be told twice. */
        history: history.slice(-8),
      }),
    })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (d) {
        wait.remove();
        if (d && d.ok) {
          mode = 'sent';
          bubble('con',
            'Sent. Somebody will come back to you \u2014 usually the same day.');
          veil.querySelector('.cx-ask').remove();
          foot('');
        } else if (d && d.reason === 'need_email') {
          err('I need an address to answer. Sign in, or write to ' +
              'hello@litenco.com directly.');
        } else if (d && d.reason === 'too_many') {
          err('That is a few messages in a short while \u2014 give us a chance ' +
              'to answer the first ones.');
        } else {
          err('That did not send. Write to hello@litenco.com and it will ' +
              'reach the same desk.');
        }
      })
      .catch(function () {
        wait.remove();
        err('That did not send. Write to hello@litenco.com and it will reach ' +
            'the same desk.');
      })
      .then(function () {
        busy = false;
        if (send) send.disabled = false;
      });
  }
})();
