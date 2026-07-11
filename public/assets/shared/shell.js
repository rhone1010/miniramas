/* shell.js — shared workshop-shell behaviors (travels to every series).
   Advanced panel toggle: starts closed (data-advpanel="closed" in the markup); click
   the collapsed rail to open, the close (‹) button to collapse again. */
(function () {
  var shell = document.getElementById('workshopShell');
  if (!shell) return;
  var adv = shell.querySelector('.adv');
  if (!adv) return;
  if (!shell.hasAttribute('data-advpanel')) shell.setAttribute('data-advpanel', 'closed'); // default closed
  adv.addEventListener('click', function () {
    if (shell.getAttribute('data-advpanel') === 'closed') shell.setAttribute('data-advpanel', 'open');
  });
  var closeBtn = adv.querySelector('.adv-close');
  if (closeBtn) closeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    shell.setAttribute('data-advpanel', 'closed');
  });
})();
