'use strict';
(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 900px)');

  // Native horizontal scrolling preserves vertical touch and wheel gestures.
  function rail(track, onChange) {
    let index = 0;
    let settling = null;
    const count = track.children.length;
    function align(smooth = false) {
      if (track.clientWidth) track.scrollTo({
        left: index * track.clientWidth,
        behavior: smooth && !motion.matches ? 'smooth' : 'instant'
      });
    }
    function select(next, smooth = true, announce = true) {
      index = (next + count) % count;
      onChange(index, announce);
      align(smooth);
    }
    function read() {
      if (!track.clientWidth || !mobile.matches) return;
      const next = Math.max(0, Math.min(count - 1, Math.round(track.scrollLeft / track.clientWidth)));
      if (next !== index) {
        index = next;
        onChange(index, true);
      }
    }
    track.addEventListener('scroll', () => {
      window.clearTimeout(settling);
      settling = window.setTimeout(read, 120);
    }, { passive: true });
    track.addEventListener('scrollend', read);
    track.addEventListener('keydown', (event) => {
      if (event.target !== track) return;
      const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: count - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      select(next);
    });
    if ('ResizeObserver' in window) new ResizeObserver(() => align()).observe(track);
    return { select, align, get index() { return index; } };
  }

  document.querySelectorAll('[data-carousel]').forEach((carousel) => {
    const slides = Array.from(carousel.querySelectorAll('[data-slide]'));
    const pause = carousel.querySelector('[data-pause]');
    const previous = carousel.querySelector('[data-prev]');
    const next = carousel.querySelector('[data-next]');
    const position = carousel.querySelector('[data-position]');
    const status = carousel.querySelector('[data-status]');
    const name = carousel.closest('section').querySelector('.hp-eyebrow').textContent;
    const desktopControls = previous.getAttribute('aria-controls');
    const track = document.createElement('div');
    track.className = 'hp-mobile-gallery';
    track.id = carousel.id + '-effects';
    track.tabIndex = 0;
    track.setAttribute('role', 'group');
    track.setAttribute('aria-label', name + ' effects, swipe or use arrow keys');
    slides.forEach((slide) => {
      slide.querySelectorAll('.hp-triptych figure').forEach((figure) => {
        const copy = figure.cloneNode(true);
        copy.setAttribute('role', 'group');
        copy.setAttribute('aria-label', (track.children.length + 1) + ' of 6');
        copy.querySelector('img').sizes = '(max-width: 695px) 92vw, 640px';
        track.appendChild(copy);
      });
    });
    carousel.prepend(track);
    let current = 0;
    let timer = null;
    let userPaused = false;
    let visible = false;
    let hovering = false;
    let focused = false;
    function stop() {
      window.clearTimeout(timer);
      timer = null;
    }
    function schedule() {
      stop();
      if (!mobile.matches && !userPaused && !motion.matches && visible && !hovering && !focused && !document.hidden) {
        timer = window.setTimeout(() => show(current + 1, false), 8000);
      }
    }
    function syncPause() {
      const paused = userPaused || motion.matches;
      pause.textContent = paused ? 'Resume rotation' : 'Pause rotation';
      pause.setAttribute('aria-pressed', String(paused));
      pause.disabled = motion.matches;
      pause.hidden = mobile.matches;
      if (motion.matches) pause.textContent = 'Rotation paused';
    }
    function show(index, announce) {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => { slide.hidden = i !== current; });
      if (!mobile.matches) position.textContent = (current + 1) + ' / ' + slides.length;
      if (announce) status.textContent = 'Triptych ' + (current + 1) + ' of ' + slides.length + '. ' + slides[current].querySelector('h3').textContent;
      schedule();
    }
    const gallery = rail(track, (index, announce) => {
      if (!mobile.matches) return;
      show(Math.floor(index / 3), false);
      position.textContent = (index + 1) + ' / 6';
      if (announce) status.textContent = 'Effect ' + (index + 1) + ' of 6. ' + slides[current].querySelector('h3').textContent;
    });
    function configure() {
      previous.setAttribute('aria-label', 'Previous ' + name.toLowerCase() + (mobile.matches ? ' effect' : ' triptych'));
      next.setAttribute('aria-label', 'Next ' + name.toLowerCase() + (mobile.matches ? ' effect' : ' triptych'));
      previous.setAttribute('aria-controls', mobile.matches ? track.id : desktopControls);
      next.setAttribute('aria-controls', mobile.matches ? track.id : desktopControls);
      if (mobile.matches) gallery.select(current * 3, false, false);
      else show(current, false);
      syncPause();
      schedule();
    }
    previous.addEventListener('click', () => mobile.matches ? gallery.select(gallery.index - 1) : show(current - 1, true));
    next.addEventListener('click', () => mobile.matches ? gallery.select(gallery.index + 1) : show(current + 1, true));
    pause.addEventListener('click', () => {
      userPaused = !userPaused;
      syncPause();
      schedule();
    });
    carousel.addEventListener('mouseenter', () => { hovering = true; stop(); });
    carousel.addEventListener('mouseleave', () => { hovering = false; schedule(); });
    carousel.addEventListener('focusin', () => { focused = true; stop(); });
    carousel.addEventListener('focusout', () => {
      window.setTimeout(() => {
        focused = carousel.contains(document.activeElement);
        schedule();
      }, 0);
    });
    document.addEventListener('visibilitychange', schedule);
    motion.addEventListener('change', () => { syncPause(); schedule(); });
    mobile.addEventListener('change', configure);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        schedule();
      }, { threshold: 0.25 }).observe(carousel);
    }
    carousel.classList.add('is-ready');
    carousel.querySelector('.hp-controls').hidden = false;
    show(0, false);
    configure();
  });

  const gifts = document.querySelector('.hp-gifts');
  gifts.id = 'gift-image-gallery';
  gifts.setAttribute('role', 'group');
  gifts.setAttribute('aria-label', 'Gift images, swipe or use arrow keys');
  const giftControls = document.createElement('div');
  giftControls.className = 'hp-controls hp-gift-controls hp-wrap';
  giftControls.innerHTML = '<button type="button" data-gift-prev aria-label="Previous gift image" aria-controls="gift-image-gallery">←</button><span data-gift-position>1 / 5</span><button type="button" data-gift-next aria-label="Next gift image" aria-controls="gift-image-gallery">→</button><span class="hp-sr-only" data-gift-status role="status" aria-live="polite" aria-atomic="true"></span>';
  gifts.after(giftControls);
  const giftRail = rail(gifts, (index, announce) => {
    giftControls.querySelector('[data-gift-position]').textContent = (index + 1) + ' / 5';
    if (announce) giftControls.querySelector('[data-gift-status]').textContent = 'Gift image ' + (index + 1) + ' of 5. ' + gifts.children[index].querySelector('img').alt;
  });
  giftControls.querySelector('[data-gift-prev]').addEventListener('click', () => giftRail.select(giftRail.index - 1));
  giftControls.querySelector('[data-gift-next]').addEventListener('click', () => giftRail.select(giftRail.index + 1));
  function configureGifts() {
    if (mobile.matches) gifts.tabIndex = 0;
    else gifts.removeAttribute('tabindex');
    giftRail.align();
  }
  mobile.addEventListener('change', configureGifts);
  configureGifts();

  // Smooth movement is requested only by an activated navigation control.
  document.querySelectorAll('.hp-advance, .hp-header a[href^="#"], .hp-skip').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button) return;
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
      target.focus({ preventScroll: true });
      window.history.pushState(null, '', link.hash);
      target.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
    });
  });
  const header = document.querySelector('.hp-header');
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--header-height', header.getBoundingClientRect().height + 'px');
    }).observe(header);
  }
  const links = Array.from(document.querySelectorAll('.hp-header nav a'));
  if ('IntersectionObserver' in window) {
    const sections = Array.from(document.querySelectorAll('.hp-section'));
    const visibility = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => visibility.set(entry.target.id, entry.intersectionRatio));
      const active = sections.reduce((best, section) => (visibility.get(section.id) || 0) > (visibility.get(best.id) || 0) ? section : best, sections[0]);
      links.forEach((link) => {
        if (link.hash === '#' + active.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    sections.forEach((section) => observer.observe(section));
  }
})();
