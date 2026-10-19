import { LiveGift, purchased, canCraft } from './live.next.js';
import { RequestSlot } from './backend-state.next.js';
import { GiftBackend, GiftApiError } from './backend.next.js';
import { newSession, recipientOptions, liveEffects, giftOption, productSubtotal, deliveryValid } from './contracts.next.js';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
const asset = (s) => new URL(s, import.meta.url).href;
let session = newSession(), view = 'photo', history = [], products = [], fixtures = [], registries = {}, manifest;
let shoppingFavoriteId = null;
let featuredProduct = '';
// Exact approved disclosure from lib/v1/gift/orders.ts, version 2026-10-18-3.
let disclosure = {
    version: '2026-10-18-3',
    text: "Your first twelve personalized artwork previews are free, provided in two sets of six. Additional sets of six are available for $2.99.\n\nOnce you've chosen your favorite artwork, you can select and purchase the gifts you'd like us to create.\n\nAfter payment, we'll prepare your artwork for each product. You'll review a clean preview of how it looks on each gift and approve each one before production begins.\n\nNothing is printed or manufactured until you've approved your gifts and submitted your order.\n\nAfter purchasing physical gifts, you may request a full refund through Concierge until your order is submitted to our print partner. Once submitted, the order is no longer eligible for this refund.\n\nAdditional artwork preview packs are separate purchases and are not included in physical-product refunds.",
};
function checkoutReady() { return !!live?.session?.artworkPreviewId && ['none', 'checkout_open'].includes(live.session.order.state) && deliveryValid(session) && disclosureAccepted && session.lines.length > 0 && !busy; }
let sourceURL = '', busy = false, limit = 0, silo = 'all', effectFocus = '', artFocus = '', compareId = '', activeProduct = '', size = '', copies = 1, editId = null, batchIndex = 0;
const params = new URLSearchParams(location.search), fixtureSeries = ['portraits', 'groups', 'pets'].includes(params.get('fixtureSeries') || '') ? params.get('fixtureSeries') : 'portraits';
const fail = params.get('fixtureFailure');
let generationAttempts = 0, compositionAttempts = 0;
function error(s) { $('error').hidden = false; $('error').textContent = s; }
function registry() { return registries[session.source?.series || fixtureSeries]; }
function effects() { return liveEffects(registry()); }
function currentArt() { return session.batches.flat().find(p => p.id === artFocus) || session.batches[batchIndex]?.[0]; }
function favorite() { return session.batches.flat().find(p => p.id === (shoppingFavoriteId || session.favoriteId)); }
function stage() { return view === 'photo' ? 0 : view === 'effects' ? 1 : ['review', 'focus', 'compare', 'more'].includes(view) ? 2 : ['products', 'configuration', 'cart'].includes(view) ? 3 : view === 'compositions' ? 5 : 4; }
function go(v, record = true) { if (busy)
    return; if (live?.session && purchased(live.session) && ['photo', 'products', 'configuration', 'cart', 'checkout'].includes(v)) {
    view = 'payment';
    render();
    return;
} if (live?.session && ['needs_attention', 'refund_requested', 'refunded', 'cancelled'].includes(live.session.order.state)) {
    view = 'payment';
    render();
    return;
} if (v === 'compositions' && !layoutReview && !(live?.session && purchased(live.session))) {
    paymentState = 'pending';
    v = 'payment';
} if (['effects', 'review', 'focus', 'compare', 'more'].includes(v) && !layoutReview && !session.source) {
    v = live || params.has('gift_order_session') ? 'payment' : 'photo';
} if (v === 'checkout' && serverMode && !live?.session?.artworkPreviewId)
    v = session.batches.length ? 'review' : 'effects'; if (['review', 'focus', 'compare'].includes(v) && !session.batches.length)
    v = 'effects'; if (record && view !== v)
    history.push(view); view = v; render(); $('screen').scrollTop = 0; if (v === 'checkout')
    $('screen').parentElement.scrollTop = 0; $('workspace').focus({ preventScroll: true }); window.scrollTo(0, 0); }
function back() { if (busy)
    return; const v = history.pop(); if (v)
    go(v, false); }
function primary(label, fn, disabled = false) { const body = document.createElement('div'); body.className = 'context-body'; while ($('right').firstChild)
    body.appendChild($('right').firstChild); $('right').appendChild(body); $('right').insertAdjacentHTML('beforeend', '<button id="primary" class="primary" ' + (busy || disabled ? 'disabled' : '') + '>' + label + ' →</button>'); $('primary').onclick = fn; }
function secondary(id, label) { return '<button id="' + id + '" class="secondary">' + label + '</button>'; }
function photo(url, alt, cls = 'photo') { return '<img class="' + cls + '" src="' + esc(url) + '" alt="' + esc(alt) + '">'; }
function field(id, label, value, attrs = '') { return '<label class="field"><span>' + label + '</span><input id="' + id + '" value="' + esc(value) + '" ' + attrs + '></label>'; }
function thumb(id) { if (session.source?.series === 'pets')
    return '/previews/pets/pets_' + id + '.jpg'; if (session.source?.series === 'groups')
    return '/previews/groups/groups_' + id + '.jpg'; const x = manifest?.effects?.[id], f = x?.neutral || x?.woman || x?.man || x?.all?.[0]; return f ? manifest.base + id + '/' + f : ''; }
function rail(title, copy) { $('left').innerHTML = (view === 'effects' ? '' : '<div class="eyebrow">A MORE MEANINGFUL GIFT</div><div class="rule"></div>') + '<h1>' + title + '</h1>' + copy + '<div id="filters"></div>' + (view === 'effects' ? '' : '<p class="tagline">More than a gift.<br>A longer story.</p>') + '<button id="back" ' + (!history.length || busy ? 'disabled' : '') + '>← Back</button>'; $('back').onclick = back; }
function render() {
    $('error').hidden = true;
    $('error').textContent = '';
    $('status').textContent = busy && view === 'effects' && !!live?.session ? 'Preparing your previews…' : layoutReview ? 'Layout review · sample artwork · no payment or order' : '';
    $('screen').dataset.view = view;
    $('left').classList.toggle('effects-rail', view === 'effects');
    $('workspace').setAttribute('aria-busy', String(busy));
    $('screen').innerHTML = '';
    $('right').innerHTML = '';
    document.querySelectorAll('.progress li').forEach((el, i) => { el.classList.toggle('done', i < stage()); if (i === stage())
        el.setAttribute('aria-current', 'step');
    else
        el.removeAttribute('aria-current'); });
    if (view === 'photo')
        renderPhoto();
    else if (view === 'products' || view === 'configuration')
        renderProducts();
    else if (view === 'cart')
        renderCart();
    else if (view === 'effects')
        renderEffects();
    else if (['review', 'focus', 'compare'].includes(view))
        renderArt();
    else if (view === 'more')
        renderMore();
    else if (view === 'compositions')
        renderCompositions();
    else if (view === 'checkout')
        renderCheckout();
    else
        renderPayment();
    if (serverMode)
        adaptServerView();
    adaptMobileView();
}
// Responsive presentation only: never changes purchases, entitlements or approval state.
let mobileFiltersOpen = false, mobileSilo = '';
let mobileActionObserver;
const mobileLayout = matchMedia('(max-width:1000px)');
mobileLayout.addEventListener('change', () => { if (products.length)
    render(); });
function adaptMobileView() {
    mobileActionObserver?.disconnect();
    if (!mobileLayout.matches || view === 'photo')
        return;
    if (view === 'configuration') {
        const original = $('right').querySelector('img');
        if (original) {
            const copy = original.cloneNode(true);
            copy.className = 'mobile-config-photo';
            $('screen').prepend(copy);
        }
    }
    if (view === 'effects') {
        document.querySelector('[data-silo="all"]')?.remove();
        const filters = $('filters'), details = document.createElement('details'), summary = document.createElement('summary');
        details.open = mobileFiltersOpen;
        details.ontoggle = () => { mobileFiltersOpen = details.open; };
        summary.className = 'mobile-filter-toggle';
        summary.textContent = registry().silos.find(s => s.id === mobileSilo)?.label || 'Browse collections';
        details.append(summary);
        while (filters.firstChild)
            details.append(filters.firstChild);
        filters.append(details);
        const tray = $('right').querySelector('.tray'), palette = $('screen').querySelector('.palette');
        if (tray && palette) {
            const count = tray.previousElementSibling;
            const label = count?.previousElementSibling;
            if (label)
                $('screen').insertBefore(label, palette);
            if (count)
                $('screen').insertBefore(count, palette);
            $('screen').insertBefore(tray, palette);
        }
    }
    if (['review', 'focus', 'compare'].includes(view)) {
        $('right').querySelector('.context-image')?.remove();
        $('right').querySelector('h2')?.remove();
    }
    // Approval stays in document flow after configuration and status on mobile.
    if (view === 'effects' || view === 'checkout') {
        const slot = document.createElement('div'), bar = document.createElement('div');
        slot.className = 'mobile-action-slot';
        bar.className = 'mobile-bottom-action';
        if (view === 'effects') {
            const count = document.createElement('p');
            count.className = 'small';
            count.textContent = session.effectIds.length + ' of 6 selected';
            bar.append(count);
        }
        // No authoritative checkout total is available in this isolated fixture.
        bar.append($('primary'));
        slot.append(bar);
        $('right').append(slot);
        slot.style.height = bar.getBoundingClientRect().height + 'px';
        mobileActionObserver = new ResizeObserver(() => { slot.style.height = bar.getBoundingClientRect().height + 'px'; });
        mobileActionObserver.observe(bar);
    }
}
function renderPhoto() {
    rail('Your<br>Photo', '<p>Let’s start with a photo and some details.</p><p>A great photo helps us create art you’ll be proud to give — and one they’ll treasure for years to come.</p>');
    $('right').innerHTML = sourceURL ? '<div class="source-holder">' + photo(sourceURL, 'Your uploaded photograph') + '</div>' + '<p>Photo uploaded.</p><p class="small">Sample analysis and artwork only. Your photo is not transformed in this preview.</p>' + secondary('change-photo', 'Change photo') : '<h2>Photo tips</h2><ul class="tips"><li>Use a clear, well-lit photo</li><li>A close-up works best</li><li>Natural lighting looks great</li><li>Avoid heavy filters</li></ul>';
    $('screen').innerHTML = '<input id="photo" type="file" accept="image/jpeg,image/png,image/webp" hidden>' + (sourceURL ? '<h2>Who is this gift for?</h2><fieldset class="radios"><legend hidden>Who is this gift for?</legend>' + recipientOptions.map(x => '<label class="radio"><input type="radio" name="recipient" value="' + esc(x) + '" ' + (session.recipient === x ? 'checked' : '') + '><span>' + x + '</span></label>').join('') + '</fieldset>' : '<h2>Upload your photo</h2><div class="upload" id="drop"><div class="upload-icon" aria-hidden="true">↑</div><p>Drag and drop your photo here<br>or</p><button id="choose-photo">Choose a Photo</button><p class="small">JPEG, PNG or WebP · up to ' + (limit / 1000000).toFixed(2) + ' MB</p></div>');
    const choose = () => { if (!busy)
        $('photo').click(); };
    if ($('choose-photo'))
        $('choose-photo').onclick = choose;
    if ($('change-photo'))
        $('change-photo').onclick = choose;
    if ($('drop')) {
        const drop = $('drop');
        drop.ondragover = e => { e.preventDefault(); drop.classList.add('drag'); };
        drop.ondragleave = () => drop.classList.remove('drag');
        drop.ondrop = e => { e.preventDefault(); drop.classList.remove('drag'); const f = e.dataTransfer?.files[0]; if (f)
            upload(f); };
    }
    $('photo').onchange = e => { const el = e.target, f = el.files?.[0]; el.value = ''; if (f)
        upload(f); };
    document.querySelectorAll('[name=recipient]').forEach(el => el.onchange = () => { session.recipient = el.value; render(); });
    primary('Choose Effects', () => go('effects'), !session.recipient || session.source?.status !== 'supported');
}
async function upload(file) {
    if (live?.session && purchased(live.session))
        return;
    if (busy)
        return;
    if (sourceURL && (session.lines.length || session.batches.length) && !confirm('Replacing your photo removes the current artwork and configured gifts. Replace photo?'))
        return;
    busy = true;
    render();
    let candidate = '';
    try {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > limit)
            throw Error('Choose a JPEG, PNG or WebP within the size limit.');
        const read = await window.MS_UPLOADER.readFileAsBase64(file);
        candidate = URL.createObjectURL(file);
        const i = new Image();
        i.src = candidate;
        await i.decode();
        if (!read.b64)
            throw Error('This photograph could not be opened.');
        if (fail === 'analysis')
            throw Error('This photograph could not be analyzed. Please try again.');
        if (fail === 'unsupported')
            throw Error('This photograph is not supported. Please choose another.');
        if (serverMode) {
            const api = new GiftBackend((url, init) => fetch(url, init)), created = await api.create(read.b64);
            live = new LiveGift(api, created.sessionId);
            live.accept(created);
            session = newSession();
            await syncCatalog();
            applyServer(created);
            const u = new URL(location.href);
            u.searchParams.set('sessionId', created.sessionId);
            window.history.replaceState(null, '', u);
            if (sourceURL)
                URL.revokeObjectURL(sourceURL);
            sourceURL = candidate;
            candidate = '';
            history = [];
            busy = false;
            render();
            return;
        }
        if (sourceURL)
            URL.revokeObjectURL(sourceURL);
        sourceURL = candidate;
        candidate = '';
        session = newSession();
        session.source = { status: 'supported', series: fixtureSeries, sourceRef: 'local-photo-' + crypto.randomUUID(), fixture: true };
        history = [];
        silo = 'all';
        effectFocus = '';
        busy = false;
        render();
    }
    catch (e) {
        busy = false;
        render();
        error(e instanceof Error ? e.message : 'This photograph could not be opened.');
    }
    finally {
        if (candidate)
            URL.revokeObjectURL(candidate);
    }
}
function chooseProduct(id) { activeProduct = id; const p = products.find(p => p.id === id); size = p.options[0].size; copies = 1; editId = null; go('configuration'); }
function renderProductCarousel() {
    const index = Math.max(0, products.findIndex(p => p.id === (featuredProduct || activeProduct))), p = products[index];
    featuredProduct = p.id;
    const canChoose = p.available && p.options.length > 0;
    $('screen').innerHTML = '<section class="gift-carousel" aria-roledescription="carousel" aria-label="Choose Your Gift"><button type="button" id="open-product-picker" aria-haspopup="dialog" aria-expanded="false" aria-controls="product-picker">Choose a Product<br><strong>' + esc(p.label) + '</strong></button><div class="gift-feature"><div id="product-picker" class="gift-product-picker" aria-label="Choose a Product"><div class="gift-picker-heading"><h2>Choose a Product</h2><button type="button" id="close-product-picker" aria-label="Close product picker">×</button></div><div class="gift-product-selectors" aria-label="Products">' + products.map(item => '<button type="button" data-feature="' + esc(item.id) + '" aria-pressed="' + (item.id === p.id) + '">' + photo(asset(item.image), '', 'gift-picker-thumb') + '<span>' + esc(item.label) + '</span><small>' + (item.available && item.options.length ? 'Available' : 'Not currently available') + '</small></button>').join('') + '</div></div><div class="gift-feature-media" id="gift-swipe">' + photo(asset(p.image), p.label, 'gift-feature-image') + '<div class="gift-carousel-controls"><button type="button" id="gift-previous" aria-label="Previous product">← Previous</button><span aria-live="polite" aria-atomic="true">' + (index + 1) + ' / ' + products.length + '</span><button type="button" id="gift-next" aria-label="Next product">Next →</button></div></div><div class="gift-feature-details" aria-live="polite" aria-atomic="true"><h2>' + esc(p.label) + '</h2><p class="gift-feature-price">' + (canChoose ? 'From ' + money(Math.min(...p.options.map(o => o.retailCents))) : 'Not currently available') + '</p><button class="primary" id="choose-featured" data-product="' + esc(p.id) + '" ' + (!canChoose ? 'disabled' : '') + '>Choose This Gift</button></div></div></section>';
    const show = (id, focus) => { const wasOpen = $('product-picker').classList.contains('is-open'); if (wasOpen)
        closePicker(); featuredProduct = id; renderProductCarousel(); document.querySelector(wasOpen ? '#open-product-picker' : focus || '#gift-next')?.focus({ preventScroll: true }); };
    const inertPickerBackground = (value) => document.querySelectorAll('.gift-header,.progress,#right,#open-product-picker,.gift-feature-media,.gift-feature-details').forEach(el => el.inert = value);
    const closePicker = () => { inertPickerBackground(false); const panel = $('product-picker'); panel.classList.remove('is-open'); panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); $('open-product-picker').setAttribute('aria-expanded', 'false'); $('open-product-picker').focus(); };
    $('open-product-picker').onclick = () => { const panel = $('product-picker'); inertPickerBackground(true); panel.classList.add('is-open'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); $('open-product-picker').setAttribute('aria-expanded', 'true'); $('close-product-picker').focus(); };
    $('close-product-picker').onclick = closePicker;
    $('product-picker').onkeydown = e => { if (!$('product-picker').classList.contains('is-open'))
        return; if (e.key === 'Escape') {
        e.preventDefault();
        closePicker();
    } if (e.key === 'Tab') {
        const buttons = Array.from($('product-picker').querySelectorAll('button'));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    } };
    const move = (delta, focus) => show(products[(index + delta + products.length) % products.length].id, focus);
    $('gift-previous').onclick = () => move(-1, '#gift-previous');
    $('gift-next').onclick = () => move(1, '#gift-next');
    document.querySelectorAll('[data-feature]').forEach(b => { b.onclick = () => show(b.dataset.feature, '[data-feature="' + b.dataset.feature + '"]'); b.onkeydown = e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const n = (index + (e.key === 'ArrowRight' ? 1 : -1) + products.length) % products.length;
        show(products[n].id, '[data-feature="' + products[n].id + '"]');
    } }; });
    $('choose-featured').onclick = () => { if (canChoose)
        chooseProduct(p.id); };
    let touch = null;
    const swipe = $('gift-swipe');
    swipe.addEventListener('touchstart', e => { touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
    swipe.addEventListener('touchend', e => { if (!touch || !e.changedTouches.length)
        return; const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y; touch = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
        move(dx < 0 ? 1 : -1); }, { passive: true });
    swipe.addEventListener('touchcancel', () => { touch = null; }, { passive: true });
}
function renderProducts() {
    rail('Choose<br>Your Gift', '<p>Bring your art to life in a format that fits your space and style.</p>');
    if (!activeProduct)
        activeProduct = products.find(p => p.available).id;
    const p = products.find(p => p.id === activeProduct);
    if (!p.options.some(o => o.size === size))
        size = p.options[0].size;
    const o = p.options.find(o => o.size === size);
    if (view === 'products') {
        renderProductCarousel();
        $('right').innerHTML = (favorite() ? '<button type="button" id="shopping-favorite" class="gift-favorite">' + photo(asset(favorite().url), favorite().label, 'gift-favorite-thumb') + '<span>Selected artwork<br>Change Artwork</span></button>' : '') + (session.lines.length ? secondary('view-cart', 'Your gifts (' + session.lines.length + ')') : '');
        if ($('shopping-favorite'))
            $('shopping-favorite').onclick = () => go('review');
        if ($('view-cart'))
            $('view-cart').onclick = () => go('cart');
        return;
    }
    $('screen').innerHTML = '<div class="product-config"><h2>2. Choose a Size</h2><div class="sizes">' + p.options.map(o => '<button data-size="' + o.size + '" aria-pressed="' + (size === o.size) + '">' + esc(o.label) + '</button>').join('') + '</div>' + field('copies', 'Quantity', String(copies), 'type="number" min="1" max="20" step="1"') + '<p class="small">' + esc(Object.entries(o.attributes || {}).map(([k, v]) => k + ': ' + v).join(' · ')) + '</p></div>';
    $('right').innerHTML = '<h3>YOUR SELECTION</h3>' + photo(asset(p.image), p.label, 'context-image') + (favorite() ? '<h3>Selected artwork</h3>' + photo(asset(favorite().url), favorite().label, 'context-image') : '') + '<h2>' + esc(p.label) + '</h2><p>' + esc(o.label) + ' · ' + money(o.retailCents) + '</p><p>' + esc(o.familyNote || '') + '</p><p class="small">' + esc(Object.entries(o.attributes || {}).map(([k, v]) => k + ': ' + v).join(' · ')) + '</p>' + '<p class="small">Product photograph. Product-specific artwork will be prepared after payment.</p>' + (session.lines.length ? secondary('view-cart', 'Your gifts (' + session.lines.length + ')') : '');
    document.querySelectorAll('[data-product]').forEach(b => b.onclick = () => chooseProduct(b.dataset.product));
    document.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { size = b.dataset.size; render(); });
    $('screen').prepend($('back'));
    $('copies').oninput = e => copies = Number(e.target.value);
    if ($('view-cart'))
        $('view-cart').onclick = () => go('cart');
    primary(editId ? 'Update This Gift' : 'Add to Cart', () => { try {
        const line = { id: editId || crypto.randomUUID(), productId: p.id, size, copies };
        giftOption(line, products);
        const n = session.lines.findIndex(l => l.id === line.id);
        if (n >= 0)
            session.lines[n] = line;
        else
            session.lines.push(line);
        session.compositions = session.compositions.filter(c => c.lineId !== line.id);
        editId = null;
        go('cart');
    }
    catch {
        error('Choose a quantity from 1 to 20.');
    } });
}
function lineMarkup(l, edit = true) { const { product: p, option: o } = giftOption(l, products); return '<div class="cart-line">' + '<div class="cart-thumbnail">' + (live?.session && purchased(live.session) ? mockup(l) : photo(asset(p.image), p.label)) + '</div><div class="cart-details"><h3>' + esc(p.label) + '</h3><p>' + esc(o.label) + ' · ' + money(o.retailCents * l.copies) + '</p><p class="small">' + esc(Object.entries(o.attributes || {}).map(([k, v]) => k + ': ' + v).join(' · ')) + '</p><div class="row"><span>Quantity ' + l.copies + '</span>' + (edit ? '<button data-qty="' + l.id + '" data-delta="-1" aria-label="Decrease ' + esc(p.label) + ' quantity" ' + (l.copies === 1 ? 'disabled' : '') + '>−</button><button data-qty="' + l.id + '" data-delta="1" aria-label="Increase ' + esc(p.label) + ' quantity" ' + (l.copies === 20 ? 'disabled' : '') + '>+</button><button data-edit="' + l.id + '">Edit</button><button data-remove="' + l.id + '">Remove</button>' : '') + '</div></div></div>'; }
function bindCart() {
    document.querySelectorAll('[data-qty]').forEach(b => b.onclick = () => { const l = session.lines.find(l => l.id === b.dataset.qty); l.copies += Number(b.dataset.delta); render(); });
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const l = session.lines.find(l => l.id === b.dataset.edit); activeProduct = l.productId; size = l.size; copies = l.copies; editId = l.id; go('configuration'); });
    document.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => { if (!confirm('Remove this gift from your order?'))
        return; session.lines = session.lines.filter(l => l.id !== b.dataset.remove); session.compositions = session.compositions.filter(c => c.lineId !== b.dataset.remove); if (!session.lines.length)
        history = history.filter(v => v === 'photo' || v === 'products'); render(); });
}
function renderCart() {
    rail('Choose<br>Your Gift', '<p>Bring your art to life in a format that fits your space and style.</p>');
    $('screen').innerHTML = '<h2>Your gifts</h2>' + session.lines.map(l => lineMarkup(l)).join('') + secondary('add-another', 'Add another gift');
    bindCart();
    $('add-another').onclick = () => { editId = null; go('products'); };
    $('right').innerHTML = (session.lines.length ? '<div data-order-summary><h2>Order summary</h2><p>Product subtotal<br>' + money(productSubtotal(session, products)) + '</p><p class="small">Shipping and tax calculated before payment.</p></div>' : '');
    primary('Next: Checkout', () => { if (live) {
        void serverAction(() => live.api.setLines(live.id, { lines: session.lines.map(l => ({ lineId: l.id, productId: l.productId + ':' + l.size, copies: l.copies })) }), 'checkout');
    }
    else
        go('checkout'); }, !session.lines.length);
}
function renderEffects() {
    rail('Choose<br>an Effect', "<p>Choose up to six effects. We'll complete your set.</p>");
    const all = effects();
    const availableSilos = registry().silos.filter(s => all.some(e => e.category === s.id));
    if (mobileLayout.matches && !availableSilos.some(s => s.id === mobileSilo))
        mobileSilo = availableSilos[0]?.id || '';
    const activeSilo = mobileLayout.matches ? mobileSilo : silo;
    if (!effectFocus || !all.some(e => e.id === effectFocus))
        effectFocus = all[0].id;
    const focused = all.find(e => e.id === effectFocus);
    $('filters').innerHTML = '<div class="filters"><button data-silo="all" aria-pressed="' + (activeSilo === 'all') + '">All Collections <span>' + all.length + '</span></button>' + registry().silos.map(s => '<button data-silo="' + s.id + '" aria-pressed="' + (activeSilo === s.id) + '">' + esc(s.label) + ' <span>' + all.filter(e => e.category === s.id).length + '</span></button>').join('') + '</div>';
    $('screen').innerHTML = '<h2>' + esc(activeSilo === 'all' ? 'All Collections' : registry().silos.find(s => s.id === activeSilo).label) + '</h2><div class="palette"><div class="grid">' + all.filter(e => activeSilo === 'all' || e.category === activeSilo).map(e => '<button class="tile" data-effect="' + e.id + '" aria-pressed="' + session.effectIds.includes(e.id) + '">' + photo(thumb(e.id), e.label) + '<span>' + esc(e.label) + '</span></button>').join('') + '</div></div>';
    $('right').innerHTML = photo(thumb(focused.id), focused.label, 'context-image') + '<h2>' + esc(focused.label) + '</h2><p class="small">YOUR PREVIEW COLLECTION</p><p class="small">' + session.effectIds.length + ' of 6 selected · LITEN will choose ' + (6 - session.effectIds.length) + '</p><div class="tray">' + Array.from({ length: 6 }, (_, i) => { const id = session.effectIds[i], e = all.find(e => e.id === id); return '<div class="tray-slot">' + (e ? photo(thumb(e.id), e.label) + '<button data-remove-effect="' + e.id + '" aria-label="Remove ' + esc(e.label) + '"><span aria-hidden="true">×</span></button>' : '') + '</div>'; }).join('') + '</div><p class="small">Sample artwork only. Your photo is not transformed in this preview.</p>';
    document.querySelectorAll('[data-silo]').forEach(b => b.onclick = () => { if (mobileLayout.matches) {
        mobileSilo = b.dataset.silo;
        mobileFiltersOpen = false;
    }
    else
        silo = b.dataset.silo; render(); document.querySelector('[data-silo="' + silo + '"]')?.focus(); });
    document.querySelectorAll('[data-effect]').forEach(b => b.onclick = () => { effectFocus = b.dataset.effect; const i = session.effectIds.indexOf(effectFocus); if (i >= 0)
        session.effectIds.splice(i, 1);
    else if (session.effectIds.length < 6)
        session.effectIds.push(effectFocus);
    else {
        render();
        error('Choose up to 6 effects.');
        return;
    } render(); document.querySelector('[data-effect="' + effectFocus + '"]')?.focus(); });
    document.querySelectorAll('[data-remove-effect]').forEach(b => b.onclick = () => { session.effectIds = session.effectIds.filter(id => id !== b.dataset.removeEffect); render(); });
    if (session.batches.length) {
        $('right').insertAdjacentHTML('beforeend', secondary('existing-previews', 'Return to My Art'));
        $('existing-previews').onclick = () => go('review');
    }
    $('right').insertAdjacentHTML('beforeend', '<p class="small">Your first two sets of six artwork previews are free. No product purchase is required. Additional sets of six: $2.99. Preview access is verified by the server.</p>');
    primary('Craft My Six Previews', () => { if (layoutReview) {
        session.batches = [fixtures];
        batchIndex = 0;
        artFocus = fixtures[0]?.id || '';
        go('review');
    }
    else
        void generate(); }, !layoutReview);
}
async function generate() { if (live) {
    const s = live.session;
    if (!s || !canCraft(s))
        return;
    await serverAction(async () => { try {
        const r = await live.api.startBatch(live.id, { ...(batchIntent || (batchIntent = { idempotencyKey: crypto.randomUUID(), effectIds: [...session.effectIds] })) });
        batchIntent = null;
        return r.session;
    }
    catch (e) {
        if (e instanceof GiftApiError && e.status === 400)
            batchIntent = null;
        throw e;
    } }, 'review');
    return;
} error('Preview access must be verified by the server.'); }
function renderArt() {
    rail('Your Previews<br>Are Ready', '<p>You can favorite the ones you love, request variations, or try again with different effects.</p>');
    const art = currentArt(), batch = session.batches[batchIndex];
    if (!compareId || !batch.some(p => p.id === compareId) || compareId === art.id)
        compareId = (batch.find(p => p.id !== art.id) || art).id;
    if (view === 'review')
        $('screen').innerHTML = '<h2>Your Six Previews</h2><div class="grid">' + batch.map(p => '<button class="tile" data-art="' + p.id + '" aria-pressed="' + ((shoppingFavoriteId || session.favoriteId) === p.id) + '">' + photo(asset(p.url), p.label + ' watermarked artwork') + '<span>' + esc(p.label) + '</span></button>').join('') + '</div>';
    else if (view === 'focus')
        $('screen').innerHTML = '<h2>' + esc(art.label) + '</h2>' + photo(asset(art.url), art.label + ' watermarked artwork') + '<div class="row">' + secondary('prev-art', '← Previous') + secondary('next-art', 'Next →') + '</div>';
    else
        $('screen').innerHTML = '<h2>Compare</h2><div class="compare">' + [art, batch.find(p => p.id === compareId)].map(p => '<button class="tile" data-art="' + p.id + '" aria-pressed="' + (p.id === art.id) + '">' + photo(asset(p.url), p.label + ' watermarked artwork') + '<span>' + esc(p.label) + '</span></button>').join('') + '</div><label class="field"><span>Compare with</span><select id="compare-choice">' + batch.filter(p => p.id !== art.id).map(p => '<option value="' + p.id + '" ' + (p.id === compareId ? 'selected' : '') + '>' + esc(p.label) + '</option>').join('') + '</select></label>';
    $('right').innerHTML = '<h2>' + esc(art.label) + '</h2>' + photo(asset(art.url), art.label, 'context-image') + '<p class="small">Sample artwork shown. Your photo is not transformed in this preview.</p><div class="actions">' + secondary('gallery', 'Return to gallery') + secondary('compare', 'Compare') + secondary('chooser', 'Adjust my selections') + (layoutName !== 'gallery-second' ? secondary('another-batch', 'Second Included Batch · Six Previews') : secondary('more', 'Six More · $2.99')) + '</div>';
    document.querySelectorAll('[data-art]').forEach(b => b.onclick = () => { artFocus = b.dataset.art; go('focus'); });
    if ($('prev-art')) {
        const cycle = (n) => { const i = batch.findIndex(p => p.id === artFocus); artFocus = batch[(i + n + batch.length) % batch.length].id; render(); };
        $('prev-art').onclick = () => cycle(-1);
        $('next-art').onclick = () => cycle(1);
    }
    if ($('compare-choice'))
        $('compare-choice').onchange = e => { compareId = e.target.value; render(); };
    if (session.batches.length > 1) {
        $('screen').insertAdjacentHTML('beforeend', '<nav class="sizes" aria-label="Your Six Previews">' + session.batches.map((_, i) => '<button data-batch="' + i + '" aria-pressed="' + (i === batchIndex) + '">' + (i + 1) + '</button>').join('') + '</nav>');
        document.querySelectorAll('[data-batch]').forEach(b => b.onclick = () => { batchIndex = Number(b.dataset.batch); artFocus = session.batches[batchIndex].find(p => p.id === session.favoriteId)?.id || session.batches[batchIndex][0].id; go('review'); });
    }
    $('gallery').onclick = () => go('review');
    $('compare').onclick = () => go('compare');
    $('chooser').onclick = () => go('effects');
    if ($('another-batch'))
        $('another-batch').onclick = generate;
    if ($('more'))
        $('more').onclick = () => go('more');
    primary('Use This Artwork', () => { if (!live) {
        shoppingFavoriteId = art.id;
        go('products');
        return;
    } if (live.session && !purchased(live.session)) {
        void serverAction(() => live.api.selectArtwork(live.id, { previewId: art.id }), 'products');
        return;
    } if (live) {
        if (live.session?.artworkPreviewId === art.id && live.session.lines.every(l => live.session.compositions.some(c => c.lineId === l.lineId && c.productId === l.productId && c.sourceArtworkId === art.id && c.compositionId && ['ready', 'approved'].includes(c.status)))) {
            go('compositions');
            return;
        }
        if (live.session?.artworkPreviewId !== art.id && live.session?.compositions.some(c => c.status === 'approved') && !confirm('Changing the artwork requires reviewing your product compositions again. Change artwork?'))
            return;
        void serverAction(async () => { const selected = live.session?.artworkPreviewId === art.id ? live.session : await live.api.selectArtwork(live.id, { previewId: art.id }); live.accept(selected); applyServer(selected); view = 'compositions'; return live.api.compose(live.id); }, 'compositions');
        return;
    } if (session.favoriteId && session.favoriteId !== art.id && session.compositions.some(c => c.approved) && !confirm('Changing the artwork requires reviewing your product compositions again. Change artwork?'))
        return; if (session.favoriteId !== art.id)
        session.compositions = []; session.favoriteId = art.id; prepareCompositions(); });
}
function renderMore() {
    rail('Create Art', '<p>Six more possibilities for your gift.</p>');
    $('screen').innerHTML = '<h2>Six More · $2.99</h2><p>Your current artwork stays here.</p>';
    $('right').innerHTML = '<p>Payments are not available in this preview. You have not been charged.</p>';
    // Paid preview packs remain blocked; no purchase event or entitlement mutation.
    primary('Return to My Art', () => go('review'));
}
function mockup(l) { if (live)
    return serverMockup(l); const { product: p } = giftOption(l, products); return photo(asset(p.image), p.label); }
async function prepareCompositions() { go('compositions'); }
let productReviewIndex = 0, orderReviewExample = false;
function renderCompositions() {
    rail('Review<br>Your Gifts', '<p>Review the artwork for each product before final approval.</p>');
    const state = layoutName === 'approval-loading' ? 'loading' : layoutName === 'approval-failed' ? 'failed' : 'ready';
    const samples = live?.session && purchased(live.session) ? session.lines : layoutReview ? session.lines.filter(l => ['framed', 'canvas'].includes(l.productId)) : [];
    const template = (l) => l.productId === 'framed' ? 'classic-framed' : 'gallery-canvas';
    const exampleNote = live ? '' : '<p class="small">LAYOUT REVIEW — example mockups only. No purchased products or artwork approvals have been verified.</p>';
    if (!samples.length) {
        $('screen').innerHTML = '<h2>Product artwork review</h2><p>Purchased product compositions are not available.</p>';
        $('right').innerHTML = '';
        primary('Approve My Gifts', () => { }, true);
        return;
    }
    if (orderReviewExample) {
        $('screen').innerHTML = '<h2>Review your gifts together</h2>' + exampleNote + samples.map(l => { const { product: p, option: o } = giftOption(l, products); return '<div class="cart-line"><div class="cart-thumbnail">' + (live ? serverMockup(l) : photo(asset('./review/payment-first/' + template(l) + '.png'), p.label + ' example')) + '</div><div class="cart-details"><h3>' + esc(p.label) + '</h3><p>' + esc(o.label) + ' · Quantity ' + l.copies + '</p><p class="small">Approval awaiting server verification</p></div></div>'; }).join('');
        $('right').innerHTML = '<h2>Final artwork approval</h2><p>Once every product is individually approved, review your gifts together before production.</p><p class="small">This is a layout example. All required approvals must be confirmed by the server before this action is available.</p>' + secondary('review-products', 'Review individual gifts');
        $('review-products').onclick = () => { orderReviewExample = false; render(); };
        primary('Approve My Gifts', () => { }, true);
        return;
    }
    productReviewIndex = Math.min(productReviewIndex, samples.length - 1);
    const l = samples[productReviewIndex], { product: p, option: o } = giftOption(l, products);
    $('screen').innerHTML = '<p class="small" role="status">Gift ' + (productReviewIndex + 1) + ' of ' + samples.length + '</p><h2>' + esc(p.label) + '</h2>' + exampleNote + (state === 'loading' ? '<p role="status">Preparing product preview…</p>' : state === 'failed' ? '<p role="alert">This product preview could not load.</p>' + secondary('retry-composition', 'Try again') : (live ? serverMockup(l) : photo(asset('./review/payment-first/' + template(l) + '.png'), p.label + ' example mockup')));
    $('right').innerHTML = '<h2>Your selection</h2><p>' + esc(p.label) + '</p><p>' + esc(o.label) + ' · Quantity ' + l.copies + '</p><p class="small">' + esc(Object.entries(o.attributes || {}).map(([k, v]) => k + ': ' + v).join(' · ')) + '</p><h3>Artwork approval</h3><p>Awaiting server verification</p><button disabled>Request a correction</button><p class="small">Correction availability and approval require the purchased product response.</p>';
    $('screen').insertAdjacentHTML('beforeend', '<nav class="sizes" aria-label="Gift review navigation"><button id="previous-product" style="color:var(--forest);border-color:var(--gold)" ' + (productReviewIndex ? '' : 'disabled') + '>← Previous Gift</button>' + (productReviewIndex < samples.length - 1 ? '<button id="next-product" style="color:var(--forest);border-color:var(--gold)">Next Gift →</button>' : '<button id="order-example" style="color:var(--forest);border-color:var(--gold)">View Order Review →</button>') + '</nav>');
    if ($('previous-product'))
        $('previous-product').onclick = () => { productReviewIndex--; render(); $('next-product')?.focus(); };
    if ($('next-product'))
        $('next-product').onclick = () => { productReviewIndex++; render(); ($('next-product') || $('order-example'))?.focus(); };
    if ($('order-example'))
        $('order-example').onclick = () => { orderReviewExample = true; render(); };
    if ($('retry-composition'))
        $('retry-composition').onclick = () => error('Product preview recovery requires the authorized composition service. Your selections are unchanged.');
    primary('Approve This Product', () => { }, true);
}
function renderCheckout() {
    rail('Checkout', '<p>Where should we send your gifts?</p>');
    $('screen').innerHTML = '<h2>Delivery information</h2><div class="sizes"><button id="ship-self" aria-pressed="' + (session.shipTo === 'self') + '">Ship to Me</button><button id="ship-recipient" aria-pressed="' + (session.shipTo === 'recipient') + '">Ship to Recipient</button></div><div class="address">' + field('email', 'Email', session.email, 'type="email" autocomplete="email"') + field('name', 'Full Name', session.address.name, 'autocomplete="shipping name"') + field('line1', 'Street Address', session.address.line1, 'autocomplete="shipping address-line1"') + field('line2', 'Apartment / Suite (optional)', session.address.line2, 'autocomplete="shipping address-line2"') + field('city', 'City', session.address.city, 'autocomplete="shipping address-level2"') + field('state', 'State', session.address.state, 'autocomplete="shipping address-level1"') + field('postcode', 'ZIP Code', session.address.postcode, 'autocomplete="shipping postal-code"') + field('countryCode', 'Country', session.address.countryCode, 'autocomplete="shipping country" maxlength="2"') + '</div>';
    // Placeholders are visual labels; the wrapping label remains the accessible name.
    document.querySelectorAll('#screen .address input').forEach(input => { input.placeholder = input.closest('label').querySelector('span').textContent; if (input.id !== 'line2' && input.id !== 'state')
        input.required = true; });
    $('countryCode').setAttribute('aria-description', 'Two-letter country code');
    $('right').innerHTML = '<div data-order-summary><h2>Order summary</h2>' + session.lines.map(l => { const { product: p, option: o } = giftOption(l, products); return '<div class="summary-item">' + photo(asset(p.image), p.label) + '<div><h3>' + esc(p.label) + '</h3><p>' + esc(o.label) + ' · Quantity ' + l.copies + '<br>' + money(o.retailCents * l.copies) + '</p></div></div>'; }).join('') + '<dl><dt>Products</dt><dd>' + money(productSubtotal(session, products)) + '</dd><dt>Shipping</dt><dd>Not quoted</dd><dt>Tax</dt><dd>Not quoted</dd><dt>Total</dt><dd>Not yet available</dd></dl></div>' + secondary('edit-gifts', 'Edit gifts');
    for (const key of ['email', ...Object.keys(session.address)])
        $(key).oninput = e => { const v = e.target.value; if (key === 'email')
            session.email = v;
        else
            session.address[key] = key === 'countryCode' ? v.toUpperCase() : v; $('primary').disabled = serverMode ? !checkoutReady() : !deliveryValid(session) || !disclosureAccepted; };
    $('ship-self').onclick = () => { session.shipTo = 'self'; render(); };
    $('ship-recipient').onclick = () => { session.shipTo = 'recipient'; render(); };
    $('edit-gifts').onclick = () => go('cart');
    // The exact server disclosure is displayed; acceptance stays beneath delivery.
    $('screen').insertAdjacentHTML('beforeend', '<section id="gift-disclosure"><h3>Your gift, made just for you</h3>' + disclosure.text.split('\n\n').map(p => '<p>' + esc(p) + '</p>').join('') + '<label class="radio"><input id="disclosure" type="checkbox" ' + (disclosureAccepted ? 'checked' : '') + '><span>I understand that product-specific compositions are prepared after payment and that I must approve them before production.</span></label></section>');
    // Keep the explanation intact in the left rail and acceptance beneath delivery.
    const explanation = $('gift-disclosure'), acceptance = $('disclosure').closest('label');
    $('screen').append(acceptance);
    $('filters').before(explanation);
    $('disclosure').setAttribute('required', '');
    $('disclosure').setAttribute('aria-describedby', 'gift-disclosure');
    $('disclosure').onchange = e => { disclosureAccepted = e.target.checked; $('primary').disabled = serverMode ? !checkoutReady() : !deliveryValid(session) || !disclosureAccepted; };
    primary('Continue to Payment', () => { paymentState = 'blocked'; go('payment'); }, !deliveryValid(session) || !disclosureAccepted || !session.lines.length);
}
const layoutViews = ['photo', 'products', 'configuration', 'cart', 'checkout', 'payment-loading', 'payment-pending', 'payment-failed', 'payment-verified', 'auth', 'restoring', 'restore-failed', 'effects', 'gallery', 'gallery-second', 'approval', 'approval-second', 'approval-final', 'approval-loading', 'approval-failed'];
const layoutName = params.get('layoutReview') || '';
const layoutReview = layoutViews.some(v => v === layoutName);
let disclosureAccepted = false, paymentState = 'blocked';
const restoration = new RequestSlot();
const serverMode = !layoutReview && params.get('fixture') !== '1';
let live = serverMode && params.get('sessionId') ? new LiveGift(new GiftBackend((url, init) => fetch(url, init)), params.get('sessionId')) : null;
async function retryRestoration() {
    paymentState = 'restoring';
    render();
    if (!live && !params.get('gift_order_session') && !params.get('gift_pack_session')) {
        paymentState = 'restore-failed';
        render();
        return;
    }
    await restoration.run(async (signal) => {
        if (params.has('gift_pack_session')) {
            const pack = params.get('gift_pack_session'), id = sessionStorage.getItem('liten-gift-pack:' + pack);
            if (!id)
                throw new GiftApiError('gift_project_reference_required', 0);
            const api = new GiftBackend((url, init) => fetch(url, init));
            if (!(await api.confirmPack({ stripeSessionId: pack }, signal)).confirmed)
                throw new GiftApiError('payment_pending', 409);
            if (!live)
                live = new LiveGift(api, id);
            if (live.id !== id)
                throw new GiftApiError('session_identity_mismatch', 0);
        }
        if (params.has('gift_order_session')) {
            const api = new GiftBackend((url, init) => fetch(url, init));
            const confirmation = await api.confirmOrder({ stripeSessionId: params.get('gift_order_session') }, signal);
            if (!confirmation.confirmed || !confirmation.session)
                throw new GiftApiError('payment_pending', 409);
            if (live && live.id !== confirmation.session.sessionId)
                throw new GiftApiError('session_identity_mismatch', 0);
            live = new LiveGift(api, confirmation.session.sessionId);
            params.delete('gift_order_session');
        }
        if (!live)
            throw new GiftApiError('gift_project_reference_required', 0);
        await live.restore(signal);
        return live.session;
    });
    const state = restoration.state;
    if (state.status === 'ready') {
        try {
            await syncCatalog();
            applyServer(state.value);
            await loadMockups();
            paymentState = purchased(state.value) ? 'payment-verified' : 'pending';
            view = state.value.order.state === 'none' ? (session.batches.length ? 'review' : 'effects') : 'payment';
            render();
        }
        catch (e) {
            live?.clear();
            paymentState = 'restore-failed';
            render();
            error(e instanceof Error ? e.message : 'request_failed');
        }
    }
    else {
        paymentState = state.status === 'failed' && state.httpStatus === 401 ? 'auth' : state.status === 'failed' && state.code === 'payment_pending' ? 'pending' : 'restore-failed';
        render();
        if (state.status === 'failed')
            error(state.code);
    }
}
function renderPayment() {
    if (paymentState === 'payment-verified') {
        rail('Your<br>Gift', '<p>Now comes the creative part.</p>');
        $('screen').innerHTML = '<h2>Your gift is on its way to becoming something special.</h2><p class="small">LAYOUT REVIEW — the confirmation copy below is a presentation example. No payment or preview entitlement has been verified.</p><p>Your purchase is confirmed. Review your personalized gifts before production.</p><p>Your selected artwork will be prepared for each purchased product. Review each composition before final approval.</p><div class="grid product-grid">' + session.lines.map(l => { const { product: p } = giftOption(l, products); return '<article class="product">' + photo(asset(p.image), p.label + ' example product') + '<h3>' + esc(p.label) + '</h3></article>'; }).join('') + '</div>';
        $('right').innerHTML = '<h2>Your purchased products</h2><p class="small">Example selections — purchase not verified.</p>' + session.lines.map(l => { const { product: p, option: o } = giftOption(l, products); return '<div class="summary-item">' + photo(asset(p.image), p.label) + '<div><h3>' + esc(p.label) + '</h3><p>' + esc(o.label) + ' · Quantity ' + l.copies + '</p></div></div>'; }).join('') + '<p class="small">Order confirmation reference will appear when provided by the authenticated backend.</p><h3>Two included sets of six previews</h3><p class="small">Included access awaits server confirmation.</p><p>Production begins only after final artwork approval.</p>';
        primary('Review Your Gifts', () => { }, true);
        return;
    }
    const states = {
        blocked: ['Payment is not available in this preview', 'Your products and delivery information remain here. No payment has been submitted.', 'Return to Checkout'],
        'payment-loading': ['Opening secure checkout', 'Checkout is loading. Product compositions require confirmed payment.', 'Checkout loading'],
        pending: ['Checking your payment', 'Returning from Stripe does not confirm payment. Your purchased project must be restored and checked by the server.', 'Check payment status'],
        'payment-pending': ['Checking your payment', 'Returning from Stripe does not confirm payment. Your purchased project must be restored and checked by the server.', 'Check payment status'],
        'payment-failed': ['Payment could not be confirmed', 'Check the payment status before trying another payment. Your gift selections remain here.', 'Check payment status'],
        'payment-verified': ['Ready for your artwork', 'After server-confirmed payment, this screen will invite you to craft your personalized artwork.', 'Choose Your Effects'],
        auth: ['Sign in to your Gift project', 'Sign in with the account used for your purchase to restore the same project.', 'Sign in'],
        restoring: ['Restoring your Gift project', 'Your purchased products and payment status must come from your account.', 'Restoring project'],
        'restore-failed': ['Your Gift project could not be restored', 'Your purchase has not been changed. Try restoring the same project again.', 'Try restoring again']
    };
    const [title, copy, action] = states[paymentState] || states.blocked;
    rail('Checkout', '<p>Your gifts are still here.</p>');
    $('screen').innerHTML = '<h2>' + title + '</h2><p role="status">' + copy + '</p>' + (layoutReview ? '<p class="small">LAYOUT REVIEW — no payment is verified, no project is purchased, and no preview access is granted.</p>' : '');
    $('right').innerHTML = '<h2>Your Gift project</h2><p>Payment verification and account restoration are not connected in this preview.</p><p class="small">No server order identity is available. A return URL cannot unlock artwork.</p>';
    primary(action, () => { if (paymentState === 'blocked')
        go('checkout');
    else if (paymentState === 'restore-failed')
        void retryRestoration();
    else
        error('This action requires the verified account and payment service. Nothing has been submitted.'); }, ['payment-loading', 'restoring', 'payment-verified', 'auth'].includes(paymentState));
}
function initializeLayoutReview() {
    if (!layoutReview)
        return;
    document.querySelector('.preview-note').textContent = 'Layout review · sample artwork · no payment or order';
    session.source = { status: 'supported', series: fixtureSeries, sourceRef: 'layout-photo', fixture: true };
    session.recipient = recipientOptions[0];
    // Draft sample lines only. Never set purchased status, order identity or entitlements.
    session.lines = (['photo', 'effects', 'gallery', 'gallery-second', 'products'].includes(layoutName) ? [] : ['framed', 'canvas']).map((id, i) => { const p = products.find(p => p.id === id); return { id: 'layout-' + i, productId: id, size: p.options.find(o => o.size === '12x18')?.size || p.options[0].size, copies: 1 }; });
    if (['products', 'configuration', 'cart', 'checkout'].includes(layoutName)) {
        session.batches = [fixtures];
        artFocus = fixtures[0]?.id || '';
        shoppingFavoriteId = artFocus;
        view = layoutName;
        return;
    }
    if (layoutName === 'photo') {
        view = 'photo';
        return;
    }
    if (layoutName === 'effects') {
        view = 'effects';
        return;
    }
    if (layoutName === 'gallery' || layoutName === 'gallery-second') {
        session.batches = [fixtures];
        batchIndex = 0;
        artFocus = fixtures[0].id;
        view = 'review';
        return;
    }
    if (layoutName.startsWith('approval')) {
        productReviewIndex = layoutName === 'approval-second' ? 1 : 0;
        orderReviewExample = layoutName === 'approval-final';
        view = 'compositions';
        return;
    }
    paymentState = layoutName;
    view = 'payment';
}
window.addEventListener('pagehide', () => { if (sourceURL)
    URL.revokeObjectURL(sourceURL); });
async function start() {
    try {
        const [c, f, m] = await Promise.all([fetch(asset('./catalog.next.json')), serverMode ? Promise.resolve(new Response('[]', { status: 200 })) : fetch(asset('./fixtures.next.json')), fetch('/previews/effects-manifest.json')]);
        if (!c.ok || !f.ok || !m.ok)
            throw Error();
        const catalog = await c.json();
        products = catalog.products;
        limit = catalog.maxUploadBytes;
        fixtures = await f.json();
        manifest = await m.json();
        for (const [series, path] of [['portraits', '/effect-registry.js'], ['groups', '/groups-registry.js'], ['pets', '/pets-registry.js']]) {
            await import(path);
            registries[series] = window.EFFECT_REGISTRY;
        }
        initializeLayoutReview();
        render();
        if (serverMode) {
            if (live || params.has('gift_order_session') || params.has('gift_pack_session')) {
                view = 'payment';
                await retryRestoration();
            }
            else
                try {
                    await new GiftBackend((url, init) => fetch(url, init)).authenticated();
                    await syncCatalog();
                    render();
                }
                catch (e) {
                    view = 'payment';
                    paymentState = e instanceof GiftApiError && e.status === 401 ? 'auth' : 'restore-failed';
                    render();
                }
        }
    }
    catch {
        error('This page could not load. Please reload to try again.');
    }
}
let batchIntent = null;
async function syncCatalog() {
    const api = live?.api || new GiftBackend((url, init) => fetch(url, init));
    const catalog = await api.catalog();
    products = products.map(p => ({ ...p, available: !['mug', 'card'].includes(p.id) && catalog.products.some(c => c.family === p.id && c.selectable), options: catalog.products.filter(c => c.family === p.id && c.status === 'launch' && c.retailCents !== null).map(c => ({ sku: c.sku, size: c.size, family: c.family, label: c.label, retailCents: c.retailCents, attributes: c.attributes, compatible: c.selectable, imageWidthIn: c.requirements.picturePx.w / c.requirements.ppi, imageHeightIn: c.requirements.picturePx.h / c.requirements.ppi, requiredPx: c.requirements.finalPx, familyNote: c.note })) }));
}
function applyServer(s) {
    const lines = s.lines.map(l => {
        const split = l.productId.lastIndexOf(':'), family = l.productId.slice(0, split);
        const p = products.find(p => p.id === family), o = p?.options.find(o => o.size === l.size);
        const g = s.geometries.find(g => g.lineId === l.lineId);
        if (!p || !o || !g || g.productId !== l.productId || g.sku !== o.sku || g.requiredPx.w !== o.requiredPx.w || g.requiredPx.h !== o.requiredPx.h)
            throw new GiftApiError('purchased_configuration_mismatch', 0);
        return { id: l.lineId, productId: family, size: l.size, copies: l.copies };
    });
    session.sessionId = s.sessionId;
    session.source = { status: 'supported', series: s.source.series, sourceRef: s.source.sourceRef, fixture: false };
    session.lines = lines;
    session.favoriteId = s.artworkPreviewId;
    shoppingFavoriteId = null;
    session.effectIds = session.effectIds.filter(id => !s.usedEffectIds.includes(id));
    session.batches = s.batches.filter(b => b.previews.some(p => p.status === 'ready' && p.url)).map(b => b.previews.filter(p => p.status === 'ready' && p.url && p.width && p.height).map(p => ({ id: p.previewId, url: p.url, label: effects().find(e => e.id === p.effectId)?.label || p.effectId, width: p.width, height: p.height, watermark: 'baked', fixture: false })));
    const retained = session.batches.findIndex(b => b.some(p => p.id === artFocus));
    const selected = session.batches.findIndex(b => b.some(p => p.id === s.artworkPreviewId));
    batchIndex = retained >= 0 ? retained : selected >= 0 ? selected : Math.max(0, session.batches.length - 1);
    artFocus = session.batches[batchIndex]?.find(p => p.id === artFocus)?.id || session.batches[batchIndex]?.find(p => p.id === s.artworkPreviewId)?.id || session.batches[batchIndex]?.[0]?.id || '';
}
async function serverAction(action, next) {
    if (!live || busy)
        return;
    busy = true;
    render();
    let failure = '';
    try {
        const s = await action();
        live.accept(s);
        applyServer(s);
        view = next === 'review' && !session.batches.length ? 'effects' : next;
        await loadMockups();
    }
    catch (e) {
        failure = e instanceof Error ? e.message : 'request_failed';
        if (e instanceof GiftApiError && e.status === 401) {
            live.clear();
            paymentState = 'auth';
            view = 'payment';
        }
    }
    finally {
        busy = false;
        render();
        if (failure)
            error(failure);
    }
}
async function loadMockups() {
    if (!live?.session || !purchased(live.session))
        return;
    await Promise.all(live.session.compositions.filter(c => c.compositionId && c.sourceArtworkId === live.session.artworkPreviewId).map(c => live.mockup(c.lineId).catch(() => null)));
}
function serverMockup(l) {
    if (live?.compositionIssues.has(l.id))
        return "<section role=\"status\" data-composition-state=\"repair-required\"><h3>We're preparing your artwork for this gift</h3><p>Your artwork needs a small adjustment to fit this product correctly. We're taking care of it.</p><p>Your selected artwork and purchase are safe. No action is needed right now.</p></section>" + secondary('check-composition-' + l.id, 'Check Again');
    const m = live?.mockups.get(l.id);
    return m && Date.parse(m.urlExpiresAt) > Date.now() ? photo(m.url, giftOption(l, products).product.label) : '<p role="status">This product preview could not load.</p>' + secondary('refresh-mockups', 'Try again');
}
function adaptServerView() {
    if (view === 'payment') {
        $('right').querySelectorAll('p').forEach(el => el.remove());
        if (paymentState === 'auth') {
            primaryLive(async () => {
                if (busy)
                    return;
                busy = true;
                render();
                try {
                    const next = '/gift-wizard.next.html' + location.search;
                    location.assign(await new GiftBackend((url, init) => fetch(url, init)).signIn(next));
                }
                catch (e) {
                    busy = false;
                    render();
                    error(e instanceof Error ? e.message : 'request_failed');
                }
            }, false);
            return;
        }
    }
    if (view === 'more' && live?.session) {
        $('right').querySelectorAll('p').forEach(el => el.remove());
        primaryLive(() => void openPack(), !['none', 'checkout_open', 'awaiting_artwork'].includes(live.session.order.state) || live.session.nextBatch.kind !== 'payment_required');
        $('primary').textContent = 'Six More · $2.99';
    }
    if (view === 'checkout') {
        primaryLive(() => void openCheckout(), !checkoutReady());
        const d = $('right').querySelector('dl');
        if (d && live?.session?.order.totalCents !== null && live?.session?.order.totalCents !== undefined)
            d.lastElementChild.textContent = money(live.session.order.totalCents);
    }
    if (view === 'photo')
        $('right').querySelectorAll('p.small').forEach(el => { if (el.textContent?.includes('Sample analysis'))
            el.textContent = ''; });
    const s = live?.session;
    document.querySelector('.preview-note').textContent = s?.order.orderId || '';
    if (!s) {
        if (view === 'payment' && ['restore-failed', 'pending'].includes(paymentState))
            primaryLive(() => void retryRestoration(), false);
        return;
    }
    if (view === 'payment' && paymentState === 'payment-verified') {
        $('screen').querySelector('.small')?.remove();
        $('right').querySelectorAll('.small').forEach(el => el.remove());
        $('right').querySelectorAll('h3').forEach(el => { if (el.textContent === 'Two included sets of six previews')
            el.textContent = String(s.entitlement.freeBatchesTotal) + ' × 6'; });
        if (s.order.totalCents !== null)
            $('right').insertAdjacentHTML('beforeend', '<p>' + money(s.order.totalCents) + '</p>');
        if (s.entitlement.freeBatchesTotal !== 2)
            $('screen').querySelectorAll('p').forEach(el => { if (el.textContent?.includes('first twelve'))
                el.textContent = ''; });
        primaryLive(() => { if (!s.artworkPreviewId) {
            go(session.batches.length ? 'review' : 'effects');
            return;
        } if (s.lines.every(l => s.compositions.some(c => c.lineId === l.lineId && c.sourceArtworkId === s.artworkPreviewId && c.compositionId && ['ready', 'approved'].includes(c.status)))) {
            go('compositions');
            return;
        } void serverAction(() => live.api.compose(live.id), 'compositions'); }, s.order.state !== 'awaiting_artwork');
    }
    else if (view === 'payment') {
        $('primary').onclick = () => void retryRestoration();
        if (!['auth', 'restoring'].includes(paymentState))
            $('primary').disabled = false;
        if (['needs_attention', 'refunded', 'refund_requested', 'cancelled'].includes(s.order.state)) {
            $('screen').querySelector('h2').textContent = 'Your Gift project';
            $('screen').querySelector('p').textContent = 'Concierge';
            primaryLive(() => location.assign('/help'), false);
            $('primary').textContent = 'Concierge';
        }
    }
    if (view === 'effects') {
        $('right').insertAdjacentHTML('beforeend', '<p class="small" role="status">' + esc(s.nextBatch.kind === 'free' ? 'Free · Six Previews' : s.nextBatch.kind === 'paid' ? 'Six previews available' : s.nextBatch.kind === 'payment_required' ? 'Six More · $2.99' : s.nextBatch.reason) + '</p>');
        document.querySelectorAll('[data-effect]').forEach(b => { b.disabled = s.usedEffectIds.includes(b.dataset.effect); });
        primaryLive(() => s.nextBatch.kind === 'payment_required' ? go('more') : void generate(), !canCraft(s) && s.nextBatch.kind !== 'payment_required');
        if (s.nextBatch.kind === 'payment_required')
            $('primary').textContent = 'Six More · $2.99';
    }
    if (['effects', 'review', 'focus', 'compare'].includes(view)) {
        $('right').querySelectorAll('p.small').forEach(el => { if (/Sample artwork|photo is not transformed|has not been verified/.test(el.textContent || ''))
            el.textContent = ''; });
    }
    if (['review', 'focus', 'compare'].includes(view)) {
        if ($('another-batch')) {
            $('another-batch').disabled = !canCraft(s) && s.nextBatch.kind !== 'payment_required';
            if (s.nextBatch.kind === 'paid')
                $('another-batch').textContent = 'Craft My Six Previews';
            if (s.nextBatch.kind === 'payment_required')
                $('another-batch').textContent = 'Six More · $2.99';
            $('another-batch').onclick = s.nextBatch.kind === 'payment_required' ? () => go('more') : () => void generate();
        }
        if ($('compare'))
            $('compare').disabled = session.batches[batchIndex].length < 2;
    }
    if (['effects', 'review', 'focus', 'compare'].includes(view)) {
        const incomplete = s.batches.find(b => !b.complete);
        if (incomplete) {
            $('right').insertAdjacentHTML('beforeend', secondary('retry-batch', 'Try again'));
            $('retry-batch').onclick = () => void serverAction(async () => { const r = await live.api.retryBatch(live.id, incomplete.batchIndex); return r.session; }, 'review');
        }
    }
    if (view === 'compositions') {
        document.querySelectorAll('[id^="check-composition-"]').forEach(b => { b.disabled = busy; b.onclick = () => void serverAction(() => live.api.restore(live.id), 'compositions'); });
        if (orderReviewExample) {
            $('right').querySelectorAll('p.small').forEach(el => el.textContent = '');
            $('screen').querySelectorAll('.cart-line').forEach((el, i) => { const c = s.compositions.find(c => c.lineId === session.lines[i]?.id); const note = el.querySelector('.small'); if (note)
                note.textContent = live.compositionIssues.has(session.lines[i]?.id) ? 'Awaiting server verification' : c?.status || ''; });
        }
        if ($('refresh-mockups'))
            $('refresh-mockups').onclick = () => void serverAction(() => live.compositionIssues.size || s.compositions.some(c => c.lineId === session.lines[productReviewIndex]?.id && c.compositionId) ? live.api.restore(live.id) : live.api.compose(live.id), 'compositions');
        if (!orderReviewExample && session.lines.length) {
            const line = session.lines[productReviewIndex], c = s.compositions.find(c => c.lineId === line?.id);
            const label = $('right').querySelector('h3');
            if (label?.nextElementSibling)
                label.nextElementSibling.textContent = live.compositionIssues.has(line.id) ? 'Awaiting server verification' : c?.status || '';
            const correction = $('right').querySelector('button');
            if (correction) {
                correction.disabled = live.compositionIssues.has(line.id) || !c?.compositionId || !c.correctionsRemaining || s.order.state !== 'awaiting_artwork';
                correction.onclick = () => void serverAction(() => live.api.correct(live.id, line.id), 'compositions');
            }
            const m = live.mockups.get(line.id);
            if (m) {
                const img = $('screen').querySelector('img');
                if (img)
                    img.addEventListener('error', () => { live.mockups.delete(line.id); render(); }, { once: true });
            }
            primaryLive(() => void serverAction(() => live.api.approveComposition(live.id, c.compositionId), 'compositions'), live.compositionIssues.has(line.id) || !c?.compositionId || c.status !== 'ready' || !m || !(Date.parse(m.urlExpiresAt) > Date.now()) || s.order.state !== 'awaiting_artwork');
        }
    }
}
function primaryLive(fn, disabled) { const b = $('primary'); if (b) {
    b.onclick = fn;
    b.disabled = busy || disabled;
} }
let embeddedOrder = null;
async function openCheckout() {
    if (!live || !checkoutReady())
        return;
    busy = true;
    render();
    try {
        const r = await live.api.checkout(live.id, { email: session.email, shippingAddress: { ...session.address }, disclosureAccepted: true, disclosureVersion: disclosure.version, returnPath: '/gift-wizard.next.html' });
        sessionStorage.setItem('liten-gift-order:' + live.id, r.stripeSessionId);
        if (r.disclosure.version !== disclosure.version || r.disclosure.text !== disclosure.text) {
            disclosure = r.disclosure;
            disclosureAccepted = false;
            busy = false;
            render();
            error('disclosure_version_mismatch');
            return;
        }
        disclosure = r.disclosure;
        if (!window.Stripe)
            await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://js.stripe.com/v3/'; script.onload = () => resolve(); script.onerror = () => reject(new GiftApiError('checkout_unavailable', 0)); document.head.append(script); });
        embeddedOrder?.destroy();
        embeddedOrder = await window.Stripe(r.publishableKey).initEmbeddedCheckout({ clientSecret: r.clientSecret, onComplete: async () => {
                embeddedOrder?.destroy();
                embeddedOrder = null;
                busy = false;
                params.set('gift_order_session', r.stripeSessionId);
                view = 'payment';
                for (let i = 0; i < 10; i++) {
                    await retryRestoration();
                    if (paymentState !== 'pending')
                        break;
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            } });
        $('screen').replaceChildren();
        const mount = document.createElement('div');
        $('screen').append(mount);
        embeddedOrder.mount(mount);
        const d = $('right').querySelector('dl');
        if (d)
            d.innerHTML = '<dt>Products</dt><dd>' + money(r.totals.itemsCents) + '</dd><dt>Shipping</dt><dd>' + money(r.totals.shippingCents) + '</dd><dt>Total</dt><dd>' + money(r.totals.totalCents) + '</dd>';
    }
    catch (e) {
        busy = false;
        if (e instanceof GiftApiError && e.code === 'order_already_paid') {
            const id = sessionStorage.getItem('liten-gift-order:' + live.id);
            if (id)
                params.set('gift_order_session', id);
            view = 'payment';
            await retryRestoration();
            return;
        }
        if (e instanceof GiftApiError && e.code === 'disclosure_version_mismatch')
            disclosureAccepted = false;
        if (e instanceof GiftApiError && e.status === 401) {
            paymentState = 'auth';
            view = 'payment';
        }
        render();
        error(e instanceof Error ? e.message : 'request_failed');
    }
}
let embeddedPack = null;
async function openPack() {
    if (!live?.session || !['none', 'checkout_open', 'awaiting_artwork'].includes(live.session.order.state) || live.session.nextBatch.kind !== 'payment_required' || busy)
        return;
    busy = true;
    render();
    try {
        const r = await live.api.packCheckout({ returnPath: '/gift-wizard.next.html' });
        sessionStorage.setItem('liten-gift-pack:' + r.stripeSessionId, live.id);
        if (!window.Stripe)
            await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://js.stripe.com/v3/'; script.onload = () => resolve(); script.onerror = () => reject(new GiftApiError('checkout_unavailable', 0)); document.head.append(script); });
        embeddedPack?.destroy();
        const checkout = await window.Stripe(r.publishableKey).initEmbeddedCheckout({ clientSecret: r.clientSecret, onComplete: async () => {
                embeddedPack?.destroy();
                embeddedPack = null;
                busy = false;
                params.set('gift_pack_session', r.stripeSessionId);
                view = 'payment';
                await retryRestoration();
            } });
        $('screen').replaceChildren();
        const mount = document.createElement('div');
        $('screen').append(mount);
        checkout.mount(mount);
        embeddedPack = checkout;
    }
    catch (e) {
        busy = false;
        render();
        error(e instanceof Error ? e.message : 'request_failed');
    }
}
start();
