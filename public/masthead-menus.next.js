/* Behavior for the five-menu masthead (see masthead-menus.next.css). Same interaction
   the pages already use for their series menu -- click to open, click outside or
   Escape to close -- plus arrow-key movement. Help, Feedback, Sign in/out and Orders
   call the page's own existing controls; nothing here replaces them. */
(function(){
'use strict';
var menus = [];
function $(id){ return document.getElementById(id); }
function visible(el){ return !!(el && el.getBoundingClientRect().width); }
function close(m, focus){ m.panel.setAttribute('hidden',''); m.btn.setAttribute('aria-expanded','false'); if (focus) m.btn.focus(); }
function closeAll(except){ menus.forEach(function(m){ if (m !== except) close(m, false); }); }
function items(m){ return [].slice.call(m.panel.querySelectorAll('[role="menuitem"]')).filter(function(a){ return !a.hidden && a.style.display !== 'none'; }); }
function open(m, focusFirst){
  closeAll(m);
  if (m.onOpen) m.onOpen();
  m.panel.removeAttribute('hidden'); m.btn.setAttribute('aria-expanded','true');
  if (focusFirst){ var list = items(m); if (list[0]) list[0].focus(); }
}
function click(id){ var el = $(id); if (el) { el.click(); return true; } return false; }
function signedOut(){
  var idb = $('mhIdentity'); if (idb) return /^\s*sign in/i.test(idb.textContent);
  var out = $('mhSignOut'); return out ? !!out.hidden : true;
}
var actions = {
  help: function(){ if (window.LitenHelp && window.LitenHelp.open) window.LitenHelp.open(); else if (!click('mhDesktopHelp')) location.assign('/help'); },
  feedback: function(){ click('mhScarab'); },
  signout: function(){ if (signedOut()){ if (!click('mhName')){ if (window.onAuthButton) window.onAuthButton(); else if (window.openSignin) window.openSignin(); } } else click('mhSignOut'); }
};
function watchOrders(){
  try { if (sessionStorage.getItem('liten_fm_orders') !== '1') return; } catch (_) { return; }
  var tries = 0;
  (function look(){
    var h = [].slice.call(document.querySelectorAll('.ac-card h3')).filter(function(x){ return /purchases/i.test(x.textContent); })[0];
    if (h){ try { sessionStorage.removeItem('liten_fm_orders'); } catch (_) {} h.scrollIntoView({block:'start'}); return; }
    if (++tries < 40) setTimeout(look, 150); else { try { sessionStorage.removeItem('liten_fm_orders'); } catch (_) {} }
  })();
}
function scrollToPurchases(){
  var tries = 0;
  (function look(){
    var h = [].slice.call(document.querySelectorAll('.ac-card h3')).filter(function(x){ return /purchases/i.test(x.textContent); })[0];
    if (h) { h.scrollIntoView({block:'start'}); return; }
    if (++tries < 20) setTimeout(look, 100);
  })();
}
function init(){
  var path = location.pathname;
  var here = path === '/groups' ? '/groups' : /^\/pets/.test(path) ? '/pets' : (path === '/' || path === '/discovery' || path === '/portraits') ? '/' : '';
  [].slice.call(document.querySelectorAll('.mh-fm .mh-series-btn')).forEach(function(btn){
    var panel = $(btn.getAttribute('aria-controls')); if (!panel) return;
    var m = { btn: btn, panel: panel };
    if (btn.id === 'mhFmAccountBtn'){
      m.onOpen = function(){
        var so = panel.querySelector('[data-fm="signout"]'); if (so) so.textContent = signedOut() ? 'Sign in' : 'Sign out';
      };
    }
    menus.push(m);
    btn.addEventListener('click', function(e){ e.stopPropagation(); if (panel.hasAttribute('hidden')) open(m, false); else close(m, false); });
    btn.addEventListener('keydown', function(e){
      if (e.key === 'ArrowDown'){ e.preventDefault(); open(m, true); }
      else if (e.key === 'Escape' && !panel.hasAttribute('hidden')){ e.preventDefault(); close(m, true); }
    });
    panel.addEventListener('keydown', function(e){
      var list = items(m), i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown'){ e.preventDefault(); (list[(i + 1) % list.length] || list[0]).focus(); }
      else if (e.key === 'ArrowUp'){ e.preventDefault(); (list[(i - 1 + list.length) % list.length] || list[0]).focus(); }
      else if (e.key === 'Home'){ e.preventDefault(); list[0].focus(); }
      else if (e.key === 'End'){ e.preventDefault(); list[list.length - 1].focus(); }
      else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(m, true); }
      else if (e.key === 'Tab'){ close(m, false); }
    });
    panel.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('[role="menuitem"]'); if (!a) return;
      var act = a.getAttribute('data-fm');
      if (act){ e.preventDefault(); close(m, false); if (actions[act]) actions[act](); return; }
      if (a.getAttribute('data-fm-orders') !== null){
        close(m, false);
        /* Where the page opens the Account panel in place (window.__showAccount), scroll
           to Purchases once it renders; elsewhere the link navigates to /account and the
           flag carries the request across the page load. */
        if (window.__showAccount) setTimeout(scrollToPurchases, 60);
        else { try { sessionStorage.setItem('liten_fm_orders', '1'); } catch (_) {} }
        return;   /* the href (/account) does the rest, exactly as the Account link does */
      }
      close(m, false);
    });
  });
  document.addEventListener('click', function(e){
    menus.forEach(function(m){ if (m.panel.hasAttribute('hidden')) return; if (!m.panel.contains(e.target) && !m.btn.contains(e.target)) close(m, false); });
  });
  addEventListener('keydown', function(e){ if (e.key === 'Escape') menus.forEach(function(m){ if (!m.panel.hasAttribute('hidden')) close(m, true); }); });
  /* A page with no feedback panel (the Print Shop host never had one) shows no Feedback item. */
  if (!$('mhScarab')) [].slice.call(document.querySelectorAll('.mh-fm [data-fm="feedback"]')).forEach(function(a){ a.hidden = true; });
  var cur = document.querySelector('#mhFmCreateMenu a[href="' + here + '"]'); if (cur) cur.setAttribute('aria-current', 'page');
  if (path === '/account') watchOrders();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
