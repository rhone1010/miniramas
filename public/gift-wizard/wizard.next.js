import { productScene } from './product-scene.next.js';
import { beautyPhoto } from './beauty-scenes.next.js';
import { giftCompositionEligibility } from '../product-studio/gift-composition-policy.next.js';
import { mountStudio, familyPhoto } from '../product-studio/studio.next.js';
import { LiveGift, purchased, canCraft } from './live.next.js';
import { RequestSlot } from './backend-state.next.js';
import { GiftBackend, GiftApiError, isApprovedScene } from './backend.next.js';
import { newSession, recipientOptions, liveEffects, giftOption, productSubtotal, deliveryValid } from './contracts.next.js';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
const asset = (s) => new URL(s, import.meta.url).href;
const productDrafts = {};
let studioState = { step: 'product', productId: '', size: '', copies: 1, drafts: productDrafts };
let session = newSession(), view = 'photo', history = [], products = [], fixtures = [], registries = {}, manifest, originalPortraitManifest;
let shoppingFavoriteId = null;
const productPhotography = new Map();
const productAvailability = new Map();
const unavailableCatalogOptions = new Map();
let featuredProduct = '';
let catalogSamples = {};
function catalogPhoto(p, cls) { const sample = session.source?.series ? catalogSamples[session.source.series]?.[p.id] : undefined; if (!sample || !isApprovedScene(p.id, sample.templateId) || !sample.desktop.endsWith('-scene-desktop.webp') || !sample.mobile.endsWith('-scene-mobile.webp'))
    return photo(asset(p.image), p.label, cls); return '<picture><source media="(max-width:600px)" srcset="' + esc(sample.mobile) + '">' + photo(sample.desktop, p.label, cls) + '</picture>'; }
// Exact approved disclosure from lib/v1/gift/orders.ts, version 2026-10-18-3.
let disclosure = {
    version: '2026-10-18-3',
    text: "Your first twelve personalized artwork previews are free, provided in two sets of six. Additional sets of six are available for $2.99.\n\nOnce you've chosen your favorite artwork, you can select and purchase the gifts you'd like us to create.\n\nAfter payment, we'll prepare your artwork for each product. You'll review a clean preview of how it looks on each gift and approve each one before production begins.\n\nNothing is printed or manufactured until you've approved your gifts and submitted your order.\n\nAfter purchasing physical gifts, you may request a full refund through Concierge until your order is submitted to our print partner. Once submitted, the order is no longer eligible for this refund.\n\nAdditional artwork preview packs are separate purchases and are not included in physical-product refunds.",
};
function checkoutReady() { return !!live?.session?.artworkPreviewId && ['none', 'checkout_open'].includes(live.session.order.state) && deliveryValid(session) && disclosureAccepted && session.lines.length > 0 && cartPreviewsReady() && !busy; }
let analyzingSource = false, serverMutation = 0;
let sourceURL = '', busy = false, limit = 0, silo = 'all', effectFocus = '', artFocus = '', compareId = '', activeProduct = '', size = '', copies = 1, editId = null, batchIndex = 0;
const params = new URLSearchParams(location.search), fixtureSeries = ['portraits', 'groups', 'pets'].includes(params.get('fixtureSeries') || '') ? params.get('fixtureSeries') : 'portraits';
const fail = params.get('fixtureFailure');
let generationAttempts = 0, compositionAttempts = 0;
let generationBatch = null, generationRequestPending = false, generationReadError = '', generationTimer;
function error(s) { $('error').hidden = false; $('error').textContent = s; }
function registry() { return registries[session.source?.series || fixtureSeries]; }
function effects() { return liveEffects(registry()); }
function currentArt() { return session.batches.flat().find(p => p.id === artFocus) || session.batches[batchIndex]?.[0]; }
function favorite() { return session.batches.flat().find(p => p.id === (shoppingFavoriteId || session.favoriteId)); }
function stage() { if (pivotMode)
    return view === 'acceptance' ? 5 : view === 'generation' ? 4 : ['cart', 'checkout', 'compositions', 'payment', 'complete'].includes(view) ? 6 : ['entry', 'photo'].includes(view) ? 0 : view === 'effects' ? 1 : studioState.step === 'product' ? 2 : 3; return view === 'photo' ? 0 : view === 'effects' ? 1 : ['review', 'focus', 'compare', 'more'].includes(view) ? 2 : ['products', 'configuration', 'cart'].includes(view) ? 3 : view === 'compositions' ? 5 : 4; }
function go(v, record = true) { if (busy)
    return; if (live?.session?.entrance === 'collection' && ['photo', 'effects', 'review', 'focus', 'compare', 'more'].includes(v))
    v = purchased(live.session) ? 'compositions' : 'products'; if (live?.session && purchased(live.session) && ['photo', 'products', 'configuration', 'cart', 'checkout'].includes(v)) {
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
    v = session.batches.length ? 'review' : 'effects'; if (['review', 'focus', 'compare'].includes(v) && !session.batches.length && !generationBatch)
    v = 'effects'; if (record && view !== v)
    history.push(view); view = v; render(); $('screen').scrollTop = 0; if (v === 'checkout')
    $('screen').parentElement.scrollTop = 0; $('workspace').focus({ preventScroll: true }); window.scrollTo(0, 0); }
function back() { if (busy)
    return; if (view === 'configuration') {
    while (history.at(-1) === 'products' || history.at(-1) === 'configuration')
        history.pop();
    go('products', false);
    return;
} const v = history.pop() || { configuration: 'products', products: 'review', cart: 'products', checkout: 'cart', focus: 'review', compare: 'review', review: 'effects', effects: 'photo' }[view]; if (v)
    go(v, false); }
function primary(label, fn, disabled = false) { const body = document.createElement('div'); body.className = 'context-body'; while ($('right').firstChild)
    body.appendChild($('right').firstChild); $('right').appendChild(body); $('right').insertAdjacentHTML('beforeend', '<button id="primary" class="primary" ' + (busy || disabled ? 'disabled' : '') + '>' + label + ' →</button>'); $('primary').onclick = fn; if (pivotMode)
    body.querySelectorAll(':scope > button').forEach(b => $('right').append(b)); }
function secondary(id, label) { return '<button id="' + id + '" class="secondary">' + label + '</button>'; }
function photo(url, alt, cls = 'photo') { return '<img class="' + cls + '" src="' + esc(url) + '" alt="' + esc(alt) + '">'; }
function field(id, label, value, attrs = '') { return '<label class="field"><span>' + label + '</span><input id="' + id + '" value="' + esc(value) + '" ' + attrs + '></label>'; }
function thumb(id) {
    const series = session.source?.series || fixtureSeries;
    if (series === 'groups')
        return '/previews/groups/groups_' + id + '.jpg';
    const library = manifest?.[series], x = library?.effects?.[id];
    // Only CC's authenticated subject analysis selects a live gender variant.
    const gender = live?.session?.source.subjectGender;
    const subject = layoutReview ? (params.get('fixtureSubject') === 'woman' ? 'woman' : 'man') : gender === 'female' ? 'woman' : gender === 'male' ? 'man' : null;
    if (series === 'portraits' && !subject) {
        const neutral = originalPortraitManifest?.effects?.[id]?.neutral;
        return neutral ? originalPortraitManifest.base + id + '/' + neutral : '';
    }
    const f = (series === 'portraits' ? x?.[subject] : x?.neutral) || x?.neutral || x?.man || x?.woman || x?.all?.[0];
    return f ? library.base + id + '/' + f : '';
}
function effectPhoto(id, label, cls = 'photo') { const url = thumb(id); return url ? photo(url, label, cls) : '<p class="small">Not currently available</p>'; }
function rail(title, copy) { $('left').innerHTML = (view === 'effects' ? '' : '<div class="eyebrow">A MORE MEANINGFUL GIFT</div><div class="rule"></div>') + '<h1>' + title + '</h1>' + copy + '<div id="filters"></div>' + (view === 'effects' ? '' : '<p class="tagline">More than a gift.<br>A longer story.</p>') + '<button id="back" ' + ((!history.length && !['configuration', 'products', 'cart', 'checkout', 'focus', 'compare', 'review', 'effects'].includes(view)) || busy ? 'disabled' : '') + '>← Back</button>'; $('back').onclick = back; if (serverMode && live?.session)
    $('left').insertAdjacentHTML('beforeend', '<button id="new-gift" data-href="/gift-wizard.next.html?newGift=1&amp;resumeSessionId=' + encodeURIComponent(live.id) + '">Start a New Gift</button>');
else if (serverMode && params.get('newGift') === '1' && params.get('resumeSessionId'))
    $('left').insertAdjacentHTML('beforeend', '<button id="resume-gift" data-href="/gift-wizard.next.html?sessionId=' + encodeURIComponent(params.get('resumeSessionId')) + '">Return to Your Gift</button>'); for (const id of ['new-gift', 'resume-gift'])
    if ($(id))
        $(id).onclick = () => { rememberView(); location.assign($(id).dataset.href); }; }
function confirmGiftExit(destination) {
    const opener = document.activeElement;
    document.getElementById('cancel-gift-dialog')?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'cancel-gift-dialog';
    dialog.setAttribute('aria-labelledby', 'cancel-gift-heading');
    dialog.innerHTML = '<h2 id="cancel-gift-heading">Cancel This Gift</h2><p>Your saved gift will remain available. Cancel returns you to the Gift Collection; it does not delete your artwork or cancel a paid order.</p><div class="actions"><button type="button" class="primary" id="keep-creating">Keep Creating</button><button type="button" id="confirm-cancel-gift">Cancel This Gift</button></div>';
    document.body.append(dialog);
    dialog.addEventListener('close', () => { dialog.remove(); opener?.focus(); }, { once: true });
    dialog.querySelector('#keep-creating').onclick = () => dialog.close();
    dialog.querySelector('#confirm-cancel-gift').onclick = () => { rememberView(); location.assign(destination); };
    dialog.showModal();
    dialog.querySelector('#keep-creating').focus();
}
function render() {
    document.body.classList.toggle('gift-pivot', pivotMode);
    if (pivotMode) {
        if (layoutReview)
            rememberPivotReview();
        setPivotProgress();
    }
    else
        document.querySelector('.progress').innerHTML = legacyProgress;
    if (live?.session?.order.state === 'approved') {
        view = 'compositions';
        orderReviewExample = true;
    }
    $('left').hidden = false;
    $('error').hidden = true;
    $('error').textContent = '';
    $('status').textContent = layoutReview ? 'Layout review · sample artwork · no payment or order' : '';
    $('screen').dataset.view = view;
    $('right').classList.toggle('artwork-actions', ['review', 'focus', 'compare'].includes(view));
    $('left').classList.toggle('effects-rail', view === 'effects');
    $('workspace').setAttribute('aria-busy', String(busy));
    $('screen').innerHTML = '';
    $('right').innerHTML = '';
    document.querySelectorAll('.progress li').forEach((el, i) => { el.classList.toggle('done', i < stage()); if (i === stage())
        el.setAttribute('aria-current', 'step');
    else
        el.removeAttribute('aria-current'); });
    if (view === 'entry')
        renderEntry();
    else if (view === 'complete')
        renderJourneyComplete();
    else if (view === 'acceptance')
        renderCompositionAcceptance();
    else if (view === 'generation')
        renderProductGeneration();
    else if (view === 'photo')
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
    if (view === 'effects' && !pivotMode) {
        const filters = $('filters');
        for (const id of ['back', 'new-gift'])
            if ($(id))
                filters.before($(id));
    }
    const exits = document.createElement('div');
    exits.className = 'actions';
    if (['cart', 'checkout'].includes(view))
        $('back').disabled = busy;
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    const resumeId = live?.id || params.get('sessionId') || params.get('resumeSessionId');
    cancel.dataset.href = '/gifts.next.html?newGift=1' + (resumeId ? '&resumeSessionId=' + encodeURIComponent(resumeId) : '');
    cancel.onclick = () => confirmGiftExit(cancel.dataset.href);
    if (!pivotMode && (view !== 'photo' || !!live?.session || !!sourceURL) && !['review', 'focus', 'compare', 'products', 'configuration'].includes(view))
        exits.append(cancel);
    if (exits.childElementCount)
        $('left').append(exits);
    if (view === 'photo' && !history.length && !pivotMode)
        $('back').hidden = true;
    document.querySelectorAll('[data-product-preview]').forEach(b => b.onclick = () => { productPreviews.delete(b.dataset.productPreview); render(); });
    adaptMobileView();
    document.querySelector('.progress').hidden = view === 'entry';
    if ($('mobile-progress'))
        $('mobile-progress').hidden = view === 'entry';
    if (pivotMode)
        sharedStageLayout();
    rememberView();
}
function renderMobileProgress() {
    const labels = Array.from(document.querySelectorAll('.progress li'), el => el.textContent || '');
    const paid = !!live?.session && purchased(live.session), restricted = !!live?.session && ['needs_attention', 'refunded', 'refund_requested', 'cancelled'].includes(live.session.order.state);
    const collection = live?.session?.entrance === 'collection';
    const available = pivotMode ? [true, !!session.source, session.effectIds.length === 1, session.effectIds.length === 1 && !!studioState.size, !!selectedGeneration(), selectedGeneration()?.status === 'ready', session.lines.length > 0] : [!paid && !collection, !!session.source && !paid && !collection, (!!session.batches.length || generationBatch !== null) && !paid && !collection, !!favorite() && !paid, paid || !!favorite() && session.lines.length > 0, paid];
    const completed = [!!session.source, !!session.batches.length, !!favorite(), session.lines.length > 0, paid, !!live?.session?.order.approvedAt];
    const current = stage(), panel = document.createElement('details');
    panel.id = 'mobile-progress';
    panel.innerHTML = '<summary aria-label="Gift progress: ' + esc(labels[current]) + '"><span class="mobile-progress-pips" aria-hidden="true">' + labels.map((_, i) => '<span class="' + (i === current ? 'current' : completed[i] ? 'completed' : '') + '">' + (i + 1) + '</span>').join('') + '</span><span class="mobile-progress-name">' + esc(labels[current]) + ' ▾</span></summary><nav aria-label="Gift steps">' + labels.map((label, i) => { const enabled = !busy && !restricted && available[i], state = i === current ? 'Current' : completed[i] ? (enabled ? 'Completed' : 'Completed · Locked') : enabled ? 'Available' : 'Locked'; return '<button type="button" data-step="' + i + '" ' + (!enabled ? 'disabled' : '') + (i === current ? ' aria-current="step"' : '') + '><span>' + (i + 1) + '. ' + esc(label) + '</span><small>' + state + '</small></button>'; }).join('') + '</nav>';
    document.querySelector('.progress').after(panel);
    panel.onkeydown = e => { if (e.key === 'Escape') {
        panel.open = false;
        panel.querySelector('summary').focus();
    } };
    panel.querySelectorAll('[data-step]').forEach(b => b.onclick = () => { const i = Number(b.dataset.step); if (busy || restricted || !available[i])
        return; panel.open = false; if (pivotMode) {
        if (i === 2)
            studioState.step = 'product';
        go(['photo', 'effects', 'products', 'products', 'generation', 'acceptance', 'checkout'][i]);
        return;
    } go(['photo', 'effects', 'review', 'products', paid ? 'payment' : 'checkout', 'compositions'][i]); });
}
function adaptMobileApproval() {
    $('left').hidden = true;
    $('screen').querySelector('.actions')?.remove();
    const body = $('right').querySelector('.context-body'), primaryButton = $('primary');
    if (!body)
        return;
    if (orderReviewExample) {
        if (primaryButton.disabled)
            primaryButton.hidden = true;
        return;
    }
    const nav = $('screen').querySelector('nav'), approval = document.createElement('section');
    approval.className = 'mobile-approval-actions';
    const heading = body.querySelector('h3'), status = heading?.nextElementSibling, correction = body.querySelector('button');
    if (heading)
        approval.append(heading);
    if (status) {
        status.setAttribute('role', 'status');
        approval.append(status);
    }
    if (!primaryButton.disabled)
        approval.append(primaryButton);
    else
        primaryButton.hidden = true;
    if (correction) {
        correction.classList.add('secondary');
        approval.append(correction);
    }
    if (nav)
        nav.before(approval);
    else
        $('screen').append(approval);
    if (session.lines.length < 2)
        nav?.querySelector('#previous-product')?.remove();
    if (!$('order-example')) {
        const review = document.createElement('button');
        review.id = 'order-example';
        review.className = 'secondary';
        review.textContent = 'View Order Review →';
        review.onclick = () => { orderReviewExample = true; render(); };
        if (nav)
            nav.after(review);
        else
            approval.after(review);
    }
    const utility = document.createElement('div');
    utility.className = 'actions review-utilities';
    const fresh = $('new-gift');
    if (fresh)
        utility.append(fresh);
    $('right').append(utility);
}
// Responsive presentation only: never changes purchases, entitlements or approval state.
let mobileFiltersOpen = false, mobileSilo = '';
let mobileActionObserver;
const mobileLayout = matchMedia('(max-width:1000px)');
mobileLayout.addEventListener('change', () => { if (products.length)
    render(); });
function adaptMobileView() {
    mobileActionObserver?.disconnect();
    document.getElementById('mobile-progress')?.remove();
    if (!mobileLayout.matches)
        return;
    renderMobileProgress();
    if (view === 'compositions')
        adaptMobileApproval();
    if (view === 'effects' && !pivotMode) {
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
    // Approval stays in document flow after configuration and status on mobile.
    if (!pivotMode && ['photo', 'effects', 'configuration', 'cart', 'checkout'].includes(view)) {
        const slot = document.createElement('div'), bar = document.createElement('div');
        slot.className = 'mobile-action-slot';
        bar.className = 'mobile-bottom-action';
        if (view === 'configuration') {
            const price = $('right').querySelector('.context-body>p');
            if (price)
                bar.append(price.cloneNode(true));
        }
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
    if (pivotMode) {
        $('left').querySelector('.tagline')?.remove();
        const start = document.createElement('button');
        start.id = 'pivot-start';
        start.textContent = 'Start Over';
        start.onclick = () => { if (sourceURL)
            confirmGiftExit('/gift-wizard.next.html?newGift=1' + (live ? '&resumeSessionId=' + encodeURIComponent(live.id) : ''));
        else
            $('photo').click(); };
        $('left').insertBefore(start, $('back'));
        const backButton = $('back');
        backButton.disabled = busy;
        backButton.textContent = 'Back';
        backButton.onclick = () => { if (history.length)
            back();
        else
            location.assign('/gifts.next.html?newGift=1' + (live ? '&resumeSessionId=' + encodeURIComponent(live.id) : '')); };
        const icon = $('screen').querySelector('.upload-icon');
        if (icon)
            icon.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="M29 70H23C10 70 7 52 20 46C17 33 29 23 40 27C48 9 74 15 77 35C96 34 101 61 84 69H72M50 88V41M34 57L50 41L66 57"/></svg>';
        const prompt = $('drop')?.querySelector('p');
        if (prompt)
            prompt.textContent = 'Drag and drop your photo here or';
    }
    if (analyzingSource) {
        $('screen').insertAdjacentHTML('beforeend', '<section class="upload analysis-feedback" role="status"><h2>Analyzing your photo…</h2></section>');
        if ($('drop'))
            $('drop').hidden = true;
    }
    const choose = () => { if (!busy)
        $('photo').click(); };
    if ($('choose-photo'))
        $('choose-photo').onclick = choose;
    if ($('change-photo'))
        $('change-photo').onclick = choose;
    if ($('choose-photo'))
        $('choose-photo').disabled = busy;
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
    if (journeyDemo && !sourceURL) {
        $('screen').insertAdjacentHTML('beforeend', secondary('demo-photo', 'Use Development Photo'));
        $('demo-photo').onclick = () => { sourceURL = thumb(effects()[0].id); go('effects'); };
    }
    if (pivotMode && sourceURL) {
        $('screen').querySelector('fieldset')?.remove();
        $('screen').querySelector('h2').textContent = 'Your Photo';
        $('screen').insertAdjacentHTML('beforeend', photo(sourceURL, 'Your uploaded photograph'));
    }
    primary('Choose Effects', () => go('effects'), (!pivotMode && !session.recipient) || session.source?.status !== 'supported');
    if (pivotMode && !sourceURL)
        $('primary').hidden = true;
}
async function upload(file) {
    if (live?.session && purchased(live.session))
        return;
    if (busy)
        return;
    if (sourceURL && (session.lines.length || session.batches.length) && !confirm('Replacing your photo removes the current artwork and configured gifts. Replace photo?'))
        return;
    busy = true;
    analyzingSource = true;
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
            restorationComplete = true;
            const u = new URL(location.href);
            u.searchParams.delete('newGift');
            u.searchParams.delete('resumeSessionId');
            u.searchParams.set('sessionId', created.sessionId);
            params.delete('newGift');
            params.delete('resumeSessionId');
            params.set('sessionId', created.sessionId);
            window.history.replaceState(null, '', u);
            if (sourceURL)
                URL.revokeObjectURL(sourceURL);
            sourceURL = candidate;
            candidate = '';
            history = [];
            busy = false;
            analyzingSource = false;
            if (pivotMode)
                view = 'effects';
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
        analyzingSource = false;
        if (pivotMode)
            view = 'effects';
        render();
    }
    catch (e) {
        busy = false;
        analyzingSource = false;
        if (e instanceof GiftApiError && e.status === 401) {
            paymentState = 'auth';
            view = 'payment';
            render();
            return;
        }
        render();
        const recovery = e instanceof GiftApiError && e.code === 'rate_limited' ? e.details : null;
        if (recovery?.resumeSessionId && /^[\w-]{1,80}$/.test(recovery.resumeSessionId)) {
            $('right').insertAdjacentHTML('afterbegin', secondary('resume-upload', 'Return to Your Gift'));
            $('resume-upload').onclick = () => location.assign('/gift-wizard.next.html?sessionId=' + encodeURIComponent(recovery.resumeSessionId));
            error('Return to Your Gift');
        }
        else
            error(e instanceof Error ? e.message : 'This photograph could not be opened.');
    }
    finally {
        if (candidate)
            URL.revokeObjectURL(candidate);
    }
}
const productPreviews = new Map();
function productPreviewReady(p, o) {
    if (!p.available || o.compatible === false)
        return false;
    if (!live)
        return true;
    const favoriteId = live.session?.artworkPreviewId;
    if (!favoriteId)
        return false;
    const entry = productPreviews.get(live.id + ':' + favoriteId + ':' + p.id + ':' + o.size), v = entry?.value;
    return !!v && !entry?.failed && (v.status === 'ready' || v.status === 'provisional') && Date.parse(v.urlExpiresAt) > Date.now() + 30000;
}
function cartPreviewsReady() { if (journeyDemo)
    return session.lines.length > 0 && demoAccepted; if (live?.session?.flow === 'generations')
    return session.lines.every(l => live.session.generations?.items.some(g => g.generationId === l.generationId && g.status === 'ready' && g.accepted)); return session.lines.every(l => { const { product, option } = giftOption(l, products); return productPreviewReady(product, option); }); }
function configurationPreview(p, o, artworkReference = false) {
    if (!live?.session?.artworkPreviewId)
        return photo(asset(p.image), p.label, 'gift-feature-image') + '<p class="small">Product photograph. Product-specific artwork will be prepared after payment.</p>';
    const owner = live, favoriteId = owner.session.artworkPreviewId, productId = p.id + ':' + o.size, key = owner.id + ':' + favoriteId + ':' + productId;
    let entry = productPreviews.get(key);
    if (entry?.value && ['ready', 'provisional'].includes(entry.value.status) && 'urlExpiresAt' in entry.value && Date.parse(entry.value.urlExpiresAt) <= Date.now() + 30000) {
        productPreviews.delete(key);
        entry = undefined;
    }
    if (!entry) {
        entry = {};
        productPreviews.set(key, entry);
        void owner.api.productPreview(owner.id, productId, favoriteId).then(value => { if (value.sku !== o.sku && value.status !== 'not_available')
            throw new GiftApiError('invalid_product_preview_response', 0); productPreviews.set(key, { value }); }).catch(e => productPreviews.set(key, { failed: true, unavailable: e instanceof GiftApiError && e.code === 'approved_scene_required' })).finally(() => { if (live === owner && owner.session?.artworkPreviewId === favoriteId && ((['products', 'configuration'].includes(view) && studioState.step === 'review' && studioState.productId === p.id && studioState.size === o.size) || view === 'cart' || view === 'checkout'))
            render(); });
    }
    if (entry.unavailable)
        return '<p role="status">Not currently available</p>';
    if (entry.failed)
        return '<p role="alert">This product preview could not load.</p><button class="secondary" data-product-preview="' + esc(key) + '">Check Again</button>';
    const v = entry.value;
    if (!v)
        return '<p role="status">Preparing product preview…</p>';
    if (v.status === 'ready')
        return photo(v.url, p.label, 'gift-feature-image') + (v.renderer === 'artwork' ? '<p class="small">' + esc(v.disclosure) + '</p>' : '') + (artworkReference ? '' : '<p class="small">Product-specific artwork will be prepared after payment.</p>');
    if (v.status === 'provisional')
        return photo(v.url, p.label + ' provisional product preview', 'gift-feature-image') + (v.renderer === 'artwork' ? '<p class="small">' + esc(v.provisional.disclosure) + '</p>' : '') + '<p class="small">Provisional product preview. The neutral surround is not artwork.</p>' + (artworkReference ? '' : '<p class="small">' + (v.provisional.finalComposition === 'generated' ? 'After payment, a new composition of the same effect will be generated for this product. You will review it before approval.' : v.provisional.finalComposition === 'deterministic' ? 'After payment, your artwork will be extended to fit this product. You will review it before approval.' : 'Product-specific artwork will be prepared after payment.') + '</p>');
    if (v.status === 'adaptation_required')
        return artworkReference && favorite() ? photo(favorite().url, 'Selected artwork') + '<p class="small">Selected artwork</p>' : '<p role="status">Product-specific artwork will be prepared after payment.</p>';
    return '<p role="status">Not currently available</p>';
}
function renderProducts() {
    if (pivotMode) {
        renderPivotProducts();
        return;
    }
    rail('Choose<br>Your Gift', '<p>Bring your art to life in a format that fits your space and style.</p>');
    if (view === 'configuration') {
        studioState = { ...studioState, step: 'review', productId: activeProduct || products.find(p => p.available).id, size, copies };
        view = 'products';
        $('screen').dataset.view = 'products';
    }
    const studioProducts = products.map(p => ({ ...p, image: familyPhoto({ id: p.id, image: asset(p.image) }), options: p.options }));
    $('right').innerHTML = (favorite() ? '<button type="button" id="shopping-favorite" class="gift-favorite">' + photo(asset(favorite().url), favorite().label, 'gift-favorite-thumb') + '<span>Selected artwork<br>Change Artwork</span></button>' : '') + (session.lines.length ? secondary('view-cart', 'Your gifts (' + session.lines.length + ')') : '');
    if ($('shopping-favorite'))
        $('shopping-favorite').onclick = () => live?.session?.entrance === 'collection' ? location.assign('/collection?from=' + live.session.source.series) : go('review');
    $('back').hidden = true;
    mountStudio($('screen'), {
        products: studioProducts, state: studioState, navigationHost: $('left'), configurationHost: $('right'),
        previewHtml: (p, o) => configurationPreview(products.find(x => x.id === p.id), o),
        canAdd: (p, o) => productPreviewReady(products.find(x => x.id === p.id), o),
        onChange: s => { studioState = s; activeProduct = s.productId; size = s.size; copies = s.copies; rememberView(); },
        onAdd: (p, o, n) => { try {
            const line = { id: editId || crypto.randomUUID(), productId: p.id, size: o.size, copies: n };
            giftOption(line, products);
            void persistCart([...session.lines.filter(l => l.id !== line.id), line]);
        }
        catch {
            error('Choose a quantity from 1 to 20.');
        } },
        onExit: () => live?.session?.entrance === 'collection' ? location.assign('/collection?from=' + live.session.source.series) : go('review'), busy, addLabel: editId ? 'Update This Gift' : 'Add to Cart'
    });
    if ($('view-cart'))
        $('view-cart').onclick = () => go('cart');
}
function lineMarkup(l, edit = true) { const { product: p, option: o } = giftOption(l, products); return '<div class="cart-line">' + '<div class="cart-thumbnail">' + (live?.session && purchased(live.session) ? mockup(l) : (journeyDemo || live?.session?.flow === 'generations') ? generationLineImage(l) : live ? configurationPreview(p, o, true) : photo(asset(p.image), p.label)) + '</div><div class="cart-details"><h3>' + esc(p.label) + '</h3><p>' + esc(o.label) + ' · ' + money(o.retailCents * l.copies) + '</p><p class="small">' + esc(Object.entries(o.attributes || {}).map(([k, v]) => k + ': ' + v).join(' · ')) + '</p>' + (live && live.session?.flow !== 'generations' && !purchased(live.session) ? '<p class="small">Product-specific artwork will be prepared after payment.</p>' : '') + '<div class="row"><span>Quantity ' + l.copies + '</span>' + (edit ? '<button data-qty="' + l.id + '" data-delta="-1" aria-label="Decrease ' + esc(p.label) + ' quantity" ' + (l.copies === 1 ? 'disabled' : '') + '>−</button><button data-qty="' + l.id + '" data-delta="1" aria-label="Increase ' + esc(p.label) + ' quantity" ' + (l.copies === 20 ? 'disabled' : '') + '>+</button><button data-edit="' + l.id + '">Edit</button><button data-remove="' + l.id + '">Remove</button>' : '') + '</div></div></div>'; }
async function persistCart(lines) {
    if (busy)
        return;
    for (const l of lines) {
        const old = session.lines.find(x => x.id === l.id), { product, option } = giftOption(l, products);
        if (live?.session?.flow !== 'generations' && (!old || old.productId !== l.productId || old.size !== l.size || l.copies > old.copies) && !productPreviewReady(product, option)) {
            render();
            return;
        }
    }
    if (!live) {
        session.lines = lines;
        editId = null;
        go('cart');
        return;
    }
    await serverAction(async () => {
        const result = await live.api.setLines(live.id, { lines: lines.map(l => ({ lineId: l.id, productId: l.productId + ':' + l.size, copies: l.copies, ...(l.generationId ? { generationId: l.generationId } : {}) })) });
        if (result.lines.length !== lines.length || lines.some(l => !result.lines.some(r => r.lineId === l.id && r.productId === l.productId + ':' + l.size && r.copies === l.copies)))
            throw new GiftApiError('invalid_cart_response', 0);
        editId = null;
        return result;
    }, 'cart');
}
function bindCart() {
    document.querySelectorAll('[data-qty]').forEach(b => b.onclick = () => void persistCart(session.lines.map(l => l.id === b.dataset.qty ? { ...l, copies: l.copies + Number(b.dataset.delta) } : l)));
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const l = session.lines.find(l => l.id === b.dataset.edit); activeProduct = l.productId; size = l.size; copies = l.copies; editId = l.id; if (pivotMode) {
        studioState = { ...studioState, step: 'size', productId: l.productId, size: l.size, copies: l.copies };
        go('products');
    }
    else
        go('configuration'); });
    document.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => { if (!confirm('Remove this gift from your order?'))
        return; void persistCart(session.lines.filter(l => l.id !== b.dataset.remove)); });
}
function renderCart() {
    rail('Choose<br>Your Gift', '<p>Bring your art to life in a format that fits your space and style.</p>');
    $('screen').innerHTML = '<h2>Your gifts</h2>' + (session.lines.length ? session.lines.map(l => lineMarkup(l)).join('') : '<p>Choose Your Gift</p>') + secondary('add-another', 'Add Another Gift');
    bindCart();
    $('add-another').onclick = () => { editId = null; studioState.step = 'product'; go('products'); };
    $('right').innerHTML = (session.lines.length ? '<div data-order-summary><h2>Order summary</h2><p>Product subtotal<br>' + money(productSubtotal(session, products)) + '</p><p class="small">Shipping and tax calculated before payment.</p></div>' : '');
    primary('Next: Checkout', () => go('checkout'), !session.lines.length || !cartPreviewsReady());
}
// Isolated review adapter for the approved migration-059 screens. No generation API is invented.
const legacyProgress = document.querySelector('.progress').innerHTML;
let pivotRestored = false;
function rememberPivotReview() { if (!pivotRestored)
    return; try {
    sessionStorage.setItem(pivotKey, JSON.stringify({ view, effectIds: session.effectIds, studioState, ...(journeyDemo ? { demoItems, demoAccepted, lines: session.lines, sourceURL: selectedGeneration()?.url || sourceURL, selectedGenerationId, email: session.email, address: session.address, disclosureAccepted } : {}) }));
}
catch { } }
function setPivotProgress() {
    document.querySelector('.progress').innerHTML = ['Upload Photo', 'Choose One Effect', 'Choose Gift', 'Gift Details', 'Personalized Review', 'Approve', 'Checkout'].map(x => '<li>' + x + '</li>').join('');
}
function restorePivotReview() {
    setPivotProgress();
    try {
        const saved = JSON.parse(sessionStorage.getItem(pivotKey) || 'null');
        if (!saved)
            return;
        const id = saved.effectIds?.[0];
        session.effectIds = effects().some(e => e.id === id) ? [id] : [];
        effectFocus = session.effectIds[0] || '';
        if (['photo', 'effects', 'products', ...(journeyDemo ? ['generation', 'acceptance', 'cart', 'checkout', 'payment', 'complete'] : [])].includes(saved.view))
            view = saved.view;
        if (journeyDemo) {
            demoItems = Array.isArray(saved.demoItems) ? saved.demoItems : [];
            for (const item of demoItems) {
                if (item.status === 'generating' || item.status === 'pending')
                    item.status = 'failed';
            }
            demoAccepted = saved.demoAccepted === true;
            session.lines = saved.lines || [];
            sourceURL = saved.sourceURL || '';
            selectedGenerationId = saved.selectedGenerationId || '';
            session.email = saved.email || '';
            if (saved.address)
                session.address = saved.address;
            disclosureAccepted = saved.disclosureAccepted === true;
        }
        if (saved.studioState && products.some(p => p.id === saved.studioState.productId)) {
            const old = saved.studioState;
            studioState = { step: ['product', 'size', 'options', 'review'].includes(old.step) ? old.step : 'product', productId: old.productId, size: typeof old.size === 'string' ? old.size : '', copies: 1, drafts: {} };
            for (const p of products) {
                const draft = old.drafts?.[p.id];
                if (draft && p.options.some(o => o.size === draft.size))
                    studioState.drafts[p.id] = { size: draft.size, copies: 1 };
            }
        }
    }
    catch { }
}
function confirmStageAction(title, message, label, action) {
    const opener = document.activeElement, dialog = document.createElement('dialog');
    dialog.className = 'cancel-gift-dialog';
    dialog.setAttribute('aria-labelledby', 'stage-confirm-title');
    dialog.innerHTML = '<h2 id="stage-confirm-title">' + esc(title) + '</h2><p>' + esc(message) + '</p><div class="actions"><button id="stage-keep">Keep Creating</button><button class="primary" id="stage-confirm">' + esc(label) + '</button></div>';
    document.body.append(dialog);
    dialog.querySelector('#stage-keep').onclick = () => dialog.close();
    dialog.querySelector('#stage-confirm').onclick = () => { dialog.close(); action(); };
    dialog.addEventListener('close', () => { dialog.remove(); opener?.focus(); }, { once: true });
    dialog.showModal();
    dialog.querySelector('#stage-keep').focus();
}
function startOverGift() {
    confirmStageAction('Start Over', journeyDemo ? 'Start a new development walkthrough? The current walkthrough progress will be cleared.' : 'Start a new gift? Your saved gift remains available. This does not cancel a paid order.', 'Start Over', () => {
        if (serverMode) {
            rememberView();
            location.assign('/gift-wizard.next.html?newGift=1' + (live ? '&resumeSessionId=' + encodeURIComponent(live.id) : ''));
            return;
        }
        sessionStorage.removeItem(pivotKey);
        session.effectIds = [];
        studioState = { step: 'product', productId: '', size: '', copies: 1, drafts: {} };
        sourceURL = '';
        history = [];
        demoItems = [];
        demoAccepted = false;
        session.lines = [];
        go('photo', false);
    });
}
function fitStage() { if (pivotMode)
    $('workspace').style.setProperty('--stage-height', Math.max(360, innerHeight - $('workspace').getBoundingClientRect().top) + 'px'); }
window.addEventListener('resize', fitStage);
function sharedStageLayout() {
    const rail = $('left');
    const disclosure = rail.querySelector('#gift-disclosure');
    if (disclosure)
        $('right').append(disclosure);
    if (view === 'cart') {
        rail.querySelector('h1').textContent = 'Your gifts';
        rail.querySelectorAll(':scope > p').forEach(p => p.remove());
    }
    const oldGuidance = rail.querySelector('.stage-guidance');
    if (oldGuidance) {
        while (oldGuidance.firstChild)
            rail.insertBefore(oldGuidance.firstChild, oldGuidance);
        oldGuidance.remove();
    }
    if (view !== 'photo') {
        rail.querySelector('.eyebrow')?.remove();
        rail.querySelector('.rule')?.remove();
    }
    rail.querySelector('.stage-fixture-note')?.remove();
    if (layoutReview && ['products', 'configuration'].includes(view)) {
        const note = document.createElement('p');
        note.className = 'small stage-fixture-note';
        note.textContent = 'Development walkthrough · sample artwork';
        rail.append(note);
    }
    rail.querySelector('.tagline')?.remove();
    $('new-gift')?.remove();
    let start = $('pivot-start');
    if (!start) {
        start = document.createElement('button');
        start.id = 'pivot-start';
        start.textContent = 'Start Over';
        rail.append(start);
    }
    start.onclick = startOverGift;
    const nav = document.createElement('div');
    nav.className = 'stage-navigation';
    const backButton = $('studio-back') || $('back');
    if (backButton)
        nav.append(backButton);
    nav.append(start);
    rail.querySelectorAll('.stage-navigation').forEach(n => n.remove());
    rail.append(nav);
    const guidance = document.createElement('div');
    guidance.className = 'stage-guidance';
    Array.from(rail.childNodes).filter(n => n !== nav).forEach(n => guidance.append(n));
    rail.insertBefore(guidance, nav);
    nav.hidden = view === 'entry' || view === 'photo' && !sourceURL && !live?.session && !history.length;
    requestAnimationFrame(fitStage);
}
function pivotRail(title) {
    rail(title, '');
    $('new-gift')?.remove();
    $('left').querySelector('.eyebrow')?.remove();
    $('left').querySelector('.rule')?.remove();
    $('left').querySelector('.tagline')?.remove();
    const start = document.createElement('button');
    start.id = 'pivot-start';
    start.textContent = 'Start Over';
    start.onclick = () => { if (serverMode) {
        rememberView();
        location.assign('/gift-wizard.next.html?newGift=1' + (live ? '&resumeSessionId=' + encodeURIComponent(live.id) : ''));
        return;
    } try {
        sessionStorage.removeItem(pivotKey);
    }
    catch { } session.effectIds = []; studioState = { step: 'product', productId: '', size: '', copies: 1, drafts: {} }; sourceURL = ''; history = []; if (journeyDemo) {
        demoItems = [];
        demoAccepted = false;
        session.lines = [];
    } go('photo', false); };
    $('left').insertBefore(start, $('back'));
}
let selectedGenerationId = '';
let productGenerationPending = false, productGenerationTimer;
function selectedGeneration() { if (journeyDemo)
    return demoItems.find(g => g.generationId === selectedGenerationId) || demoItems.at(-1); return live?.session?.generations?.items.find(g => g.generationId === selectedGenerationId) || live?.session?.generations?.items.at(-1); }
function generationLineImage(l) { const g = (journeyDemo ? demoItems : live?.session?.generations?.items)?.find(g => g.generationId === l.generationId); return g?.url ? generationPicture(g, l.productId, l.size) : '<p role="status">This product preview could not load.</p>'; }
function productIntentKey() { return 'liten-gift-generation:' + live.id + ':' + live.session.generations.effectId + ':' + studioState.productId + ':' + studioState.size; }
async function craftProduct(retry = false) {
    if (!live || busy || productGenerationPending || live.session?.flow !== 'generations')
        return;
    const owner = live, key = productIntentKey();
    let intent;
    try {
        intent = retry ? crypto.randomUUID() : localStorage.getItem(key) || crypto.randomUUID();
        localStorage.setItem(key, intent);
    }
    catch {
        error('request_failed');
        return;
    }
    productGenerationPending = true;
    busy = true;
    view = 'generation';
    render();
    try {
        const r = await owner.api.generateProduct(owner.id, { productId: studioState.productId + ':' + studioState.size, idempotencyKey: intent, mode: retry ? 'new' : 'reuse_or_generate' });
        if (live !== owner)
            return;
        owner.accept(r.session);
        applyServer(r.session);
        selectedGenerationId = r.generation.generationId;
    }
    catch (e) {
        productGenerationPending = false;
        busy = false;
        render();
        error(e instanceof Error ? e.message : 'request_failed');
        return;
    }
    finally {
        productGenerationPending = false;
        busy = false;
    }
    render();
    scheduleProductGenerationRead();
}
function scheduleProductGenerationRead() { clearTimeout(productGenerationTimer); if (!live || !['pending', 'generating'].includes(selectedGeneration()?.status || ''))
    return; productGenerationTimer = setTimeout(() => void readProductGeneration(), 5000); }
async function readProductGeneration() { const owner = live; if (!owner || productGenerationPending)
    return; try {
    const s = await owner.api.restore(owner.id);
    if (live !== owner)
        return;
    owner.accept(s);
    applyServer(s);
    render();
}
catch (e) {
    error(e instanceof Error ? e.message : 'request_failed');
}
finally {
    scheduleProductGenerationRead();
} }
function selectedProduct() { const p = products.find(p => p.id === studioState.productId); return { p, o: p?.options.find(o => o.size === studioState.size) }; }
function generationPicture(g, productId = studioState.productId, size = studioState.size) {
    const p = products.find(p => p.id === productId), o = p?.options.find(o => o.size === size);
    if (!p || !o || !g.url)
        return '';
    const source = live && purchased(live.session) ? productPhotography.get(p.id + ':' + o.size) : beautyPhoto(p, o), key = g.generationId + ':' + p.id + ':' + o.size;
    if (scenePictures.has(key))
        return photo(scenePictures.get(key), p.label + ' · ' + o.label + ' · personalized composition', 'gift-feature-image');
    if (source && !scenePending.has(key) && !sceneFailures.has(key)) {
        scenePending.add(key);
        void productScene(source, g.url, o.imageWidthIn / o.imageHeightIn).then((url) => { scenePictures.set(key, url); }).catch(() => sceneFailures.add(key)).finally(() => { scenePending.delete(key); if (['generation', 'acceptance', 'cart', 'checkout', 'complete', 'payment'].includes(view))
            render(); });
    }
    return photo(g.url, 'Your exact composition', 'gift-feature-image') + '<p class="small" role="status">' + (!source || sceneFailures.has(key) ? 'Product photography is not available for this configuration. Your exact artwork is shown.' : 'Preparing your product photograph…') + '</p>';
}
function generationDetails() { const { p, o } = selectedProduct(); return '<h2>' + esc(p?.label || 'Your Gift') + '</h2><p>' + esc(o?.label || '') + '</p><p>' + esc(Object.entries(o?.attributes || {}).map(([k, v]) => k + ': ' + v).join(' · ')) + '</p><p>' + esc(effects().find(e => e.id === session.effectIds[0])?.label || '') + '</p>'; }
function changeGenerationSelection() { go('effects'); }
function renderProductGeneration() {
    const g = selectedGeneration(), a = live?.session?.generations?.allowance;
    pivotRail('Your<br>Crafted Images');
    $('screen').innerHTML = g?.url ? generationPicture(g) : '<section class="craft-progress" role="status"><div class="craft-gears" aria-hidden="true">⚙<span>⚙</span></div><h2>' + (g?.status === 'failed' ? 'Crafting did not finish' : 'Crafting Your Image') + '</h2><p>' + (journeyDemo ? 'Development demonstration · no generation request.' : g?.status === 'failed' ? 'Your selections are here. Change Effect or Product to try again.' : 'Your selected effect is being prepared for your gift. This may take a little time.') + '</p></section>';
    $('right').innerHTML = generationDetails();
    primary('Review &amp; Approve', () => go('acceptance'), !g || g.status !== 'ready' || !g.url || !g.sha256);
    $('right').insertAdjacentHTML('beforeend', '<div class="actions">' + secondary('change-generation', 'Change Effect or Product') + '</div>');
    $('change-generation').onclick = changeGenerationSelection;
    const items = journeyDemo ? demoItems : live?.session?.generations?.items.filter(x => x.status === 'ready') || [];
    if (items.length)
        $('right').insertAdjacentHTML('beforeend', '<section class="saved-compositions"><h3>Saved compositions</h3><div class="composition-history">' + items.filter(x => x.url).map((x, i) => '<button data-generation="' + esc(x.generationId) + '" aria-label="View composition ' + (i + 1) + '" aria-pressed="' + (g?.generationId === x.generationId) + '">' + photo(x.url, 'Composition ' + (i + 1)) + '</button>').join('') + '</div></section>');
    document.querySelectorAll('[data-generation]').forEach(b => b.onclick = () => { selectedGenerationId = b.dataset.generation; render(); });
    $('right').insertAdjacentHTML('beforeend', a ? '<p class="small">' + a.freeRemaining + ' / ' + a.freeTotal + ' free generations remaining</p>' : journeyDemo ? '<p class="small">Development demonstration · no generation allowance consumed.</p>' : '');
    $('back').disabled = busy;
    $('back').onclick = () => { studioState.step = 'size'; go('products'); };
}
function renderCompositionAcceptance() {
    const g = selectedGeneration();
    pivotRail('Approve<br>Composition');
    $('screen').innerHTML = g ? generationPicture(g) : '';
    $('right').innerHTML = generationDetails() + '<p>Review the people, details and arrangement in your artwork. Accept this exact composition to continue.</p>' + (g?.accepted ? '<p role="status">Composition accepted. Payment and manufacturing release are separate.</p>' : '') + secondary('review-again', 'Back to Image');
    primary(g?.accepted ? 'Add to Cart' : 'Accept Composition', () => { if (journeyDemo) {
        if (!g)
            return;
        if (!g.accepted) {
            g.accepted = true;
            demoAccepted = true;
            render();
            return;
        }
        session.lines = [...session.lines.filter(l => l.id !== editId), { id: editId || crypto.randomUUID(), productId: studioState.productId, size: studioState.size, copies: studioState.copies, generationId: g.generationId }];
        editId = null;
        go('cart');
        return;
    } void acceptProductGeneration(); }, !g || g.status !== 'ready');
    $('review-again').onclick = () => go('generation');
    $('back').disabled = false;
    $('back').onclick = () => go('generation');
}
function demoCraft() {
    const { p, o } = selectedProduct();
    if (!p || !o)
        return;
    const id = 'development-' + crypto.randomUUID();
    selectedGenerationId = id;
    demoItems.push({ generationId: id, productId: p.id + ':' + o.size, status: 'generating', url: null, width: null, height: null, sha256: null, accepted: false });
    go('generation');
    setTimeout(() => { const g = demoItems.find(x => x.generationId === id); g.status = 'ready'; g.url = thumb(session.effectIds[0]); g.width = 1024; g.height = 1024; g.sha256 = 'development-sample-not-production'; if (view === 'generation')
        render(); }, 1200);
}
function renderJourneyComplete() {
    pivotRail('Your<br>Gift');
    $('screen').innerHTML = '<h2>Checkout demonstration complete</h2>' + session.lines.map(l => lineMarkup(l, false)).join('') + '<p role="status">Development demonstration only. No payment, customer approval, order or manufacturing request was submitted.</p>';
    $('right').innerHTML = '<h2>What happens next</h2><p>In the live journey, payment confirmation comes from the payment provider. Manufacturing remains separately controlled.</p>';
    primary('Return to Your Gift', () => go('cart'));
    $('back').disabled = false;
    $('back').onclick = () => go('checkout');
}
async function acceptProductGeneration() {
    const g = selectedGeneration();
    if (!live || busy || g?.status !== 'ready' || !g.url || !g.sha256)
        return;
    if (!g.accepted) {
        await serverAction(async () => { const r = await live.api.acceptGeneration(live.id, g.generationId); return r.session; }, 'acceptance');
        return;
    }
    const productId = studioState.productId + ':' + studioState.size;
    await persistCart([...session.lines.filter(l => l.id !== editId), { id: editId || crypto.randomUUID(), productId: studioState.productId, size: studioState.size, copies: studioState.copies, generationId: g.generationId }]);
}
function renderPivotEffects() {
    pivotRail('Choose<br>an Effect');
    const all = effects(), silos = registry().silos.filter(x => all.some(e => e.category === x.id));
    if (!effectFocus || !all.some(e => e.id === effectFocus))
        effectFocus = session.effectIds[0] || all[0]?.id || '';
    if (silo === 'all' || !silos.some(x => x.id === silo))
        silo = silos[0]?.id || '';
    const focused = all.find(e => e.id === effectFocus);
    if (!focused)
        return;
    $('filters').innerHTML = '<h2>' + esc((session.source?.series || fixtureSeries) === 'groups' ? 'Groups' : (session.source?.series || fixtureSeries) === 'pets' ? 'Pets' : 'Portraits') + '</h2><div class="filters">' + silos.map(x => '<button data-silo="' + x.id + '" aria-pressed="' + (silo === x.id) + '">' + esc(x.label) + '</button>').join('') + '</div>';
    $('screen').innerHTML = '<div class="palette effect-library">' + silos.map(x => '<section id="effect-section-' + x.id + '"><h2>' + esc(x.label) + '</h2><div class="grid">' + all.filter(e => e.category === x.id).map(e => '<button class="tile" data-effect="' + e.id + '" aria-pressed="' + (effectFocus === e.id) + '">' + effectPhoto(e.id, e.label) + '<span>' + esc(e.label) + '</span></button>').join('') + '</div></section>').join('') + '</div>';
    $('right').innerHTML = '<h2>' + esc(focused.label) + '</h2>' + effectPhoto(focused.id, focused.label, 'context-image');
    document.querySelectorAll('[data-silo]').forEach(b => b.onclick = () => { silo = b.dataset.silo; document.querySelectorAll('[data-silo]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.silo === silo))); const section = $('effect-section-' + silo), scroller = window.matchMedia('(max-width: 760px)').matches ? document.querySelector('.effect-library') : document.querySelector('.center'); if (section && scroller)
        scroller.scrollTo({ top: scroller.scrollTop + section.getBoundingClientRect().top - scroller.getBoundingClientRect().top, behavior: 'smooth' }); });
    document.querySelectorAll('[data-effect]').forEach(b => b.onclick = () => { const scroll = $('screen').closest('.center').scrollTop, paletteScroll = $('screen').querySelector('.palette').scrollTop; effectFocus = b.dataset.effect; session.effectIds = [effectFocus]; render(); $('screen').closest('.center').scrollTop = scroll; $('screen').querySelector('.palette').scrollTop = paletteScroll; });
    primary('Choose This Effect', () => { session.effectIds = [effectFocus]; studioState.step = 'product'; if (live?.session?.flow === 'generations')
        void serverAction(() => live.api.chooseEffect(live.id, effectFocus), 'products');
    else
        go('products'); });
}
function renderPivotProducts() {
    pivotRail(studioState.step === 'product' ? 'Choose<br>your Gift' : 'Choose<br>your Size');
    $('right').innerHTML = '';
    $('back').hidden = true;
    const familyOrder = ['fine_art', 'premium', 'framed', 'mug', 'matted', 'canvas', 'framed_canvas', 'card'];
    const choices = [...products].sort((a, b) => familyOrder.indexOf(a.id) - familyOrder.indexOf(b.id)).map(p => ({ ...p, unavailableOptions: unavailableCatalogOptions.get(p.id), image: beautyPhoto({ id: p.id, image: asset(p.image) }), options: p.options.filter(o => productAvailability.has(p.id + ':' + o.size) || giftCompositionEligibility(p, o, pivotSubjectCount()).allowed) }));
    mountStudio($('screen'), { products: choices, state: studioState, navigationHost: $('left'), configurationHost: $('right'),
        sizeHeading: 'Choose a Size to Continue', requireSizeClick: true, detailsIntroHtml: (p, o) => '<h3>Your Product</h3>' + (o.familyNote ? '<div class="product-guidance"><p>' + esc(o.familyNote) + '</p></div>' : ''), detailsHtml: (p, o) => { if (!o)
            return photo(p.image, p.label); const url = beautyPhoto(p, o); return url ? photo(url, p.label) : '<p role="status">Product photography unavailable.</p>'; }, previewHtml: p => photo(p.image, p.label), canAdd: (p, o) => p.available && o.compatible !== false && (journeyDemo || !!live?.session?.generations?.effectId && ['free', 'paid'].includes(live.session.generations.allowance.next)), onAdd: () => journeyDemo ? demoCraft() : void craftProduct(), busy, addLabel: 'Show me a Preview of My Art',
        onChange: s => { studioState = s; requestAnimationFrame(sharedStageLayout); if (layoutReview)
            rememberPivotReview();
        else
            rememberView(); $('left').querySelector('h1').innerHTML = s.step === 'product' ? 'Choose<br>your Gift' : 'Choose<br>your Size'; document.body.dataset.pivotStep = s.step; document.querySelectorAll('.progress li').forEach((el, i) => { if (i === stage())
            el.setAttribute('aria-current', 'step');
        else
            el.removeAttribute('aria-current'); }); if (mobileLayout.matches) {
            $('mobile-progress')?.remove();
            renderMobileProgress();
        } },
        onExit: () => go('effects'), utilityHtml: '' });
    document.body.dataset.pivotStep = studioState.step;
}
function renderEffects() {
    if (pivotMode) {
        renderPivotEffects();
        return;
    }
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
    $('screen').innerHTML = '<h2>' + esc(activeSilo === 'all' ? 'All Collections' : registry().silos.find(s => s.id === activeSilo).label) + '</h2><div class="palette"><div class="grid">' + all.filter(e => activeSilo === 'all' || e.category === activeSilo).map(e => '<button class="tile" data-effect="' + e.id + '" aria-pressed="' + session.effectIds.includes(e.id) + '">' + effectPhoto(e.id, e.label) + '<span>' + esc(e.label) + '</span></button>').join('') + '</div></div>';
    $('right').innerHTML = effectPhoto(focused.id, focused.label, 'context-image') + '<h2>' + esc(focused.label) + '</h2><p class="small">YOUR PREVIEW COLLECTION</p><p class="small">' + session.effectIds.length + ' of 6 selected · LITEN will choose ' + (6 - session.effectIds.length) + '</p><div class="tray">' + Array.from({ length: 6 }, (_, i) => { const id = session.effectIds[i], e = all.find(e => e.id === id); return '<div class="tray-slot">' + (e ? effectPhoto(e.id, e.label) + '<button data-remove-effect="' + e.id + '" aria-label="Remove ' + esc(e.label) + '"><span aria-hidden="true">×</span></button>' : '') + '</div>'; }).join('') + '</div><p class="small">Sample artwork only. Your photo is not transformed in this preview.</p>';
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
var MC_MARK_HTML = '<svg class="mc-mark" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g class="mc-mark__turn"><circle cx="50" cy="50" r="38"/><path d="M50 12L50 4.5"/><path d="M69 17.091L72.75 10.596"/><path d="M82.909 31L89.404 27.25"/><path d="M88 50L95.5 50"/><path d="M82.909 69L89.404 72.75"/><path d="M69 82.909L72.75 89.404"/><path d="M50 88L50 95.5"/><path d="M31 82.909L27.25 89.404"/><path d="M17.091 69L10.596 72.75"/><path d="M12 50L4.5 50"/><path d="M17.091 31L10.596 27.25"/><path d="M31 17.091L27.25 10.596"/></g><circle class="mc-mark__inner" cx="50" cy="50" r="27"/><g class="mc-mark__l" transform="translate(50 50) scale(0.018) translate(-924.5 -554.5)"><path d="M172.56,1026.32c59.81,48.06,167.33,108.29,234.49,43.34,7.51-7.31,14.09-15.71,19.67-24.61,14.26-22.72,27.44-46.14,40.28-69.82,83.98-157.75,157.81-319.91,244.49-476.7C801.63,337.72,965.34,47.14,1154.78,4.06c88.2-19.98,141.96,35.8,143.68,122.23,1.12,95.19-39.97,192.18-84.39,273.81-93.21,165.69-234.35,310.02-411.93,383.69-5.71,2.42-21.1,8.7-27.03,11.13-178.31,73.57-367.14,118.04-552.95,166.23-11.79,3.35-23.39,6.86-34.14,10.6-9.16,3.31-17.04,6.06-24.62,10.66-.25.17-.32.22,0-.08.14-.14.41-.4.72-.77,7.93-8.72,8.56-25.97.32-35.04,14.34,10.4,36.07,17.08,55.77,20.74,34.75,6.27,69.19,6.14,105.17,4.33,176.62-12.72,347.97-58.86,523.64-86.29,130.65-20.98,263.65-37.6,396.19-24.79,49.45,5.65,103.1,14.17,152.36,21.46,97.36,15.3,195.97,32.36,291.93,54.87,24.85,5.93,49.69,12.09,74.04,19.77-12.49-2.61-25.05-4.79-37.62-6.84-50.29-8.14-100.85-14.43-151.47-20.13-62.17-7.05-127.74-13.25-190-18.63-43.03-3.55-89.66-7.6-132.88-10.53-31.08-1.82-62.18-1.67-93.37-.24-151.37,7.7-299.78,41.98-447.26,75.18-99.09,22.36-201.57,47.15-301.96,62.43-86.59,12.25-198.26,24.95-278.16-18.32-12.4-6.79-25.28-16.07-33.28-29.59-10.83-17.98-9.36-40.69,2.8-57.12,7.02-10.09,18.48-18.14,28.49-23.56,10.25-5.6,21.37-10.08,31.7-13.92,57.8-20.47,128.2-36.9,187.44-53.11,139.82-37.08,278.41-79.27,411.88-134.93,163.21-65.41,293.58-197.81,380.71-348.59,34.61-61.51,64.82-128.9,75.25-198.55,2.93-23.14,4.66-49.37-4.84-69.61-3.72-7.21-8.08-10.62-16.07-12.07-12.64-2.13-26.56,1.43-38.98,4.9-88.91,27.75-170.29,121.13-227.41,192.8-155.4,200.75-270.39,428.27-400.72,645.65-30.08,49.42-59.98,99.34-95.82,144.97-74.38,87.72-191.88,22.29-259.39-40.51h0Z"/></g></svg>';
// The animation follows server slot status; requesting a batch is not proof it started.
async function generate() {
    if (!live || busy || generationRequestPending || !live.session || !canCraft(live.session))
        return;
    const owner = live, revision = serverMutation;
    generationBatch = live.session.batches.length + 1;
    generationRequestPending = true;
    generationReadError = '';
    batchIntent ||= { idempotencyKey: crypto.randomUUID(), effectIds: [...session.effectIds] };
    view = 'review';
    render();
    scheduleGenerationRead();
    try {
        const r = await owner.api.startBatch(owner.id, batchIntent);
        if (live === owner && revision === serverMutation && !busy) {
            owner.accept(r.session);
            applyServer(r.session);
        }
        batchIntent = null;
    }
    catch (e) {
        generationReadError = e instanceof Error ? e.message : 'request_failed';
        if (e instanceof GiftApiError && e.status === 400) {
            batchIntent = null;
            generationBatch = null;
            view = 'effects';
        }
        if (e instanceof GiftApiError && e.status === 401) {
            live.clear();
            paymentState = 'auth';
            view = 'payment';
        }
    }
    finally {
        generationRequestPending = false;
        settleGeneration();
        render();
        if (generationReadError)
            error(generationReadError);
        scheduleGenerationRead();
    }
}
function settleGeneration() {
    const b = live?.session?.batches.find(b => b.batchIndex === generationBatch);
    if (b?.complete && b.previews.length === 6 && b.previews.every(p => p.status === 'ready' && p.url)) {
        generationBatch = null;
        batchIntent = null;
        clearTimeout(generationTimer);
        generationReadError = '';
    }
}
function scheduleGenerationRead() {
    clearTimeout(generationTimer);
    const s = live?.session, b = s?.batches.find(b => b.batchIndex === generationBatch);
    if (!generationBatch || !s || b?.generation === 'failed' || b?.generation === 'stalled' || (!generationRequestPending && b && !b.previews.some(p => p.status === 'pending' || p.status === 'generating')))
        return;
    generationTimer = setTimeout(() => void refreshGeneration().then(() => resumeStalledBatches()), 1500);
}
const resumedBatches = new Set();
async function resumeStalledBatches() {
    const owner = live, revision = serverMutation;
    if (!owner?.session || generationRequestPending || busy)
        return;
    for (const b of owner.session.batches) {
        const key = owner.id + ':' + b.batchIndex;
        if (b.generation !== 'stalled' || resumedBatches.has(key))
            continue;
        resumedBatches.add(key);
        generationRequestPending = true;
        try {
            const r = await owner.api.retryBatch(owner.id, b.batchIndex);
            if (live !== owner || revision !== serverMutation || busy)
                return;
            owner.accept(r.session);
            applyServer(r.session);
            generationReadError = '';
        }
        catch (e) {
            if (live !== owner)
                return;
            generationReadError = e instanceof Error ? e.message : 'request_failed';
        }
        finally {
            generationRequestPending = false;
            if (live === owner) {
                settleGeneration();
                render();
                scheduleGenerationRead();
            }
        }
    }
}
async function refreshGeneration() {
    if (!live || !generationBatch)
        return;
    try {
        const owner = live, revision = serverMutation, s = await owner.api.restore(owner.id);
        if (live !== owner || revision !== serverMutation || busy)
            return;
        owner.accept(s);
        applyServer(s);
        generationReadError = '';
        settleGeneration();
        render();
        scheduleGenerationRead();
    }
    catch (e) {
        generationReadError = e instanceof Error ? e.message : 'request_failed';
        clearTimeout(generationTimer);
        if (e instanceof GiftApiError && e.status === 401) {
            live.clear();
            paymentState = 'auth';
            view = 'payment';
        }
        render();
        error(generationReadError);
        if (!(e instanceof GiftApiError && e.status === 401))
            scheduleGenerationRead();
    }
}
function renderGeneration() {
    rail('Create Art', '');
    const b = live?.session?.batches.find(b => b.batchIndex === generationBatch);
    const heading = b?.previews.some(p => p.status === 'ready' && p.url) ? 'Choose One Artwork' : b?.previews.some(p => p.status === 'generating') ? 'Creating Your Previews' : 'Waiting to start…';
    $('screen').innerHTML = '<h2>' + heading + '</h2><div class="grid">' + Array.from({ length: 6 }, (_, i) => {
        const p = b?.previews.find(p => p.slot === i + 1), label = p ? effects().find(e => e.id === p.effectId)?.label || p.effectId : '';
        if (p?.status === 'ready' && p.url)
            return '<button class="tile" data-art="' + p.previewId + '" aria-pressed="' + (session.favoriteId === p.previewId) + '">' + photo(p.url, label + ' watermarked artwork') + '<span>' + esc(label) + '</span></button>';
        const working = p?.status === 'generating' && (!b?.generation || b.generation === 'running'), failed = p?.status === 'failed' || b?.generation === 'failed';
        return '<div class="tile card ' + (working ? 'is-crafting' : failed ? 'is-failed' : '') + '"><div class="card__art">' + (working ? MC_MARK_HTML : '') + '</div><span role="status">' + (working ? 'Crafting…' : failed ? 'Didn’t finish' : '') + '</span></div>';
    }).join('') + '</div>';
    $('right').innerHTML = (favorite() ? '<h2>' + esc(favorite().label) + '</h2>' : '') + (generationReadError ? '<p role="alert">' + esc(generationReadError) + '</p>' : '');
    if (b?.generation === 'stalled' || (b?.generation !== 'failed' && b?.previews.some(p => p.status === 'failed' && p.retryable) && !b.previews.some(p => p.status === 'pending' || p.status === 'generating'))) {
        $('right').insertAdjacentHTML('beforeend', secondary('retry-generation', 'Try again'));
        $('retry-generation').onclick = async () => { if (generationRequestPending || !live)
            return; generationRequestPending = true; try {
            const r = await live.api.retryBatch(live.id, b.batchIndex);
            live.accept(r.session);
            applyServer(r.session);
            generationReadError = '';
        }
        catch (e) {
            generationReadError = e instanceof Error ? e.message : 'request_failed';
        }
        finally {
            generationRequestPending = false;
            settleGeneration();
            render();
            scheduleGenerationRead();
        } };
    }
    document.querySelectorAll('[data-art]').forEach(b => b.onclick = () => void selectPreview(b.dataset.art));
    primary('Choose Your Gift', () => go('products'), !favorite());
    $('primary').hidden = !favorite();
}
async function selectPreview(id) {
    if (busy || !session.batches.flat().some(p => p.id === id))
        return;
    if (live?.session?.artworkPreviewId !== id && live?.session?.compositions.some(c => c.status === 'approved') && !confirm('Changing the artwork requires reviewing your product compositions again. Change artwork?'))
        return;
    artFocus = id;
    if (!live) {
        shoppingFavoriteId = id;
        session.favoriteId = id;
        go('focus');
        return;
    }
    if (live.session?.artworkPreviewId === id) {
        go('focus');
        return;
    }
    await serverAction(async () => { const result = await live.api.selectArtwork(live.id, { previewId: id }); if (result.artworkPreviewId !== id)
        throw new GiftApiError('artwork_selection_not_confirmed', 0); return result; }, 'focus');
}
function renderArt() {
    if (view === 'review' && generationBatch) {
        renderGeneration();
        return;
    }
    rail('Choose Your Artwork', '');
    const art = currentArt(), batch = session.batches[batchIndex];
    if (!compareId || !batch.some(p => p.id === compareId) || compareId === art.id)
        compareId = (batch.find(p => p.id !== art.id) || art).id;
    if (view === 'review')
        $('screen').innerHTML = '<div class="grid artwork-gallery">' + batch.map(p => '<button class="tile" data-art="' + p.id + '" aria-pressed="' + ((shoppingFavoriteId || session.favoriteId) === p.id) + '">' + photo(asset(p.url), p.label + ' watermarked artwork') + '<span>' + esc(p.label) + '</span></button>').join('') + '</div>';
    else if (view === 'focus')
        $('screen').innerHTML = photo(asset(art.url), art.label + ' watermarked artwork') + '<div class="row">' + secondary('prev-art', '← Previous') + secondary('next-art', 'Next →') + '</div>';
    else
        $('screen').innerHTML = '<h2>Compare Artwork</h2><div class="compare">' + [art, batch.find(p => p.id === compareId)].map(p => '<button class="tile" data-art="' + p.id + '" aria-pressed="' + (p.id === art.id) + '">' + photo(asset(p.url), p.label + ' watermarked artwork') + '<span>' + esc(p.label) + '</span></button>').join('') + '</div><label class="field"><span>Compare with</span><select id="compare-choice">' + batch.filter(p => p.id !== art.id).map(p => '<option value="' + p.id + '" ' + (p.id === compareId ? 'selected' : '') + '>' + esc(p.label) + '</option>').join('') + '</select></label>';
    $('right').innerHTML = '<h2>' + esc(art.label) + '</h2>' + '<p class="small">Sample artwork shown. Your photo is not transformed in this preview.</p><div class="actions">' + secondary('gallery', 'Return to gallery') + secondary('compare', 'Compare Artwork') + secondary('chooser', 'Adjust my selections') + (layoutName !== 'gallery-second' ? secondary('another-batch', 'Create My Second Six Previews') : secondary('more', 'Six More · $2.99')) + '</div>';
    document.querySelectorAll('[data-art]').forEach(b => b.onclick = () => void selectPreview(b.dataset.art));
    if ($('prev-art')) {
        const cycle = (n) => { const i = batch.findIndex(p => p.id === artFocus); void selectPreview(batch[(i + n + batch.length) % batch.length].id); };
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
        $('another-batch').onclick = () => go('effects');
    if ($('more'))
        $('more').onclick = () => go('more');
    primary(live?.session && purchased(live.session) ? 'Use This Artwork' : 'Choose Your Gift', () => { if (!live) {
        go('products');
        return;
    } if (live.session && !purchased(live.session)) {
        go('products');
        return;
    } if (live) {
        if (live.session?.artworkPreviewId === art.id && live.session.lines.every(l => live.session.compositions.some(c => c.lineId === l.lineId && c.productId === l.productId && c.sourceArtworkId === art.id && c.compositionId && ['ready', 'approved'].includes(c.status)))) {
            go('compositions');
            return;
        }
        if (live.session?.artworkPreviewId !== art.id && live.session?.compositions.some(c => c.status === 'approved') && !confirm('Changing the artwork requires reviewing your product compositions again. Change artwork?'))
            return;
        void serverAction(async () => { const selected = live.session?.artworkPreviewId === art.id ? live.session : await live.api.selectArtwork(live.id, { previewId: art.id }); live.accept(selected); applyServer(selected); view = 'compositions'; return composePurchasedArtwork(); }, 'compositions');
        return;
    } if (session.favoriteId && session.favoriteId !== art.id && session.compositions.some(c => c.approved) && !confirm('Changing the artwork requires reviewing your product compositions again. Change artwork?'))
        return; if (session.favoriteId !== art.id)
        session.compositions = []; session.favoriteId = art.id; prepareCompositions(); }, !favorite());
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
        $('screen').innerHTML = '<h2>Review your gifts together</h2>' + exampleNote + samples.map(l => { const { product: p, option: o } = giftOption(l, products); return '<div class="cart-line"><div class="cart-thumbnail">' + (live ? serverMockup(l) : catalogPhoto(p, '')) + '</div><div class="cart-details"><h3>' + esc(p.label) + '</h3><p>' + esc(o.label) + ' · Quantity ' + l.copies + '</p><p class="small">Approval awaiting server verification</p></div></div>'; }).join('');
        $('right').innerHTML = '<h2>Final artwork approval</h2><p>Once every product is individually approved, review your gifts together before production.</p><p class="small">This is a layout example. All required approvals must be confirmed by the server before this action is available.</p>' + secondary('review-products', 'Review individual gifts');
        $('review-products').onclick = () => { orderReviewExample = false; render(); };
        primary('Approve My Gifts', () => { }, true);
        return;
    }
    productReviewIndex = Math.min(productReviewIndex, samples.length - 1);
    const l = samples[productReviewIndex], { product: p, option: o } = giftOption(l, products);
    $('screen').innerHTML = '<p class="small" role="status">Gift ' + (productReviewIndex + 1) + ' of ' + samples.length + '</p><h2>' + esc(p.label) + '</h2>' + exampleNote + (state === 'loading' ? '<p role="status">Preparing product preview…</p>' : state === 'failed' ? '<p role="alert">This product preview could not load.</p>' + secondary('retry-composition', 'Try again') : (live ? serverMockup(l) : catalogPhoto(p, '')));
    $('right').innerHTML = '<h2>Your selection</h2><p>' + esc(p.label) + '</p><p>' + esc(o.label) + ' · Quantity ' + l.copies + '</p><p class="small">' + esc(Object.entries(o.attributes || {}).map(([k, v]) => k + ': ' + v).join(' · ')) + '</p><h3>Artwork approval</h3><p>Awaiting server verification</p><button disabled>Request a correction</button><p class="small">Correction availability and approval require the purchased product response.</p>';
    $('screen').insertAdjacentHTML('beforeend', '<nav class="sizes" aria-label="Gift review navigation"><button id="previous-product" style="color:var(--forest);border-color:var(--gold)" ' + (productReviewIndex ? '' : 'disabled') + '>← Previous Gift</button>' + (productReviewIndex < samples.length - 1 ? '<button id="next-product" style="color:var(--forest);border-color:var(--gold)">Next Gift →</button>' : '<button id="order-example" style="color:var(--forest);border-color:var(--gold)">View Order Review →</button>') + '</nav>');
    if ($('previous-product'))
        $('previous-product').onclick = () => { productReviewIndex--; render(); if (mobileLayout.matches) {
            $('workspace').focus({ preventScroll: true });
            window.scrollTo(0, 0);
        }
        else
            $('next-product')?.focus(); };
    if ($('next-product'))
        $('next-product').onclick = () => { productReviewIndex++; render(); if (mobileLayout.matches) {
            $('workspace').focus({ preventScroll: true });
            window.scrollTo(0, 0);
        }
        else
            ($('next-product') || $('order-example'))?.focus(); };
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
    $('right').innerHTML = '<div data-order-summary><h2>Order summary</h2>' + session.lines.map(l => { const { product: p, option: o } = giftOption(l, products); return '<div class="summary-item"><div>' + ((journeyDemo || live?.session?.flow === 'generations') ? generationLineImage(l) : live ? configurationPreview(p, o, true) : photo(asset(p.image), p.label)) + '</div><div><h3>' + esc(p.label) + '</h3><p>' + esc(o.label) + ' · Quantity ' + l.copies + '<br>' + money(o.retailCents * l.copies) + '</p></div></div>'; }).join('') + '<dl><dt>Products</dt><dd>' + money(productSubtotal(session, products)) + '</dd><dt>Shipping</dt><dd>Not quoted</dd><dt>Tax</dt><dd>Not quoted</dd><dt>Total</dt><dd>Not yet available</dd></dl></div>' + secondary('edit-gifts', 'Edit gifts');
    for (const key of ['email', ...Object.keys(session.address)])
        $(key).oninput = e => { const v = e.target.value; if (key === 'email')
            session.email = v;
        else
            session.address[key] = key === 'countryCode' ? v.toUpperCase() : v; $('primary').disabled = serverMode ? !checkoutReady() : !deliveryValid(session) || !disclosureAccepted; if (journeyDemo)
            rememberPivotReview(); };
    $('ship-self').onclick = () => { session.shipTo = 'self'; render(); };
    $('ship-recipient').onclick = () => { session.shipTo = 'recipient'; render(); };
    $('edit-gifts').onclick = () => go('cart');
    // The exact server disclosure is displayed; acceptance stays beneath delivery.
    $('screen').insertAdjacentHTML('beforeend', '<section id="gift-disclosure"><h3>Your gift, made just for you</h3>' + (pivotMode ? 'Your accepted composition stays attached to this gift. Review your delivery details and order summary before payment.\n\nArtwork acceptance, payment and manufacturing release are separate steps.' : disclosure.text).split('\n\n').map(p => '<p>' + esc(p) + '</p>').join('') + '<label class="radio"><input id="disclosure" type="checkbox" ' + (disclosureAccepted ? 'checked' : '') + '><span>' + (pivotMode ? 'I have reviewed my composition and delivery details.' : 'I understand that product-specific compositions are prepared after payment and that I must approve them before production.') + '</span></label></section>');
    // Keep the explanation intact in the left rail and acceptance beneath delivery.
    const explanation = $('gift-disclosure'), acceptance = $('disclosure').closest('label');
    $('screen').append(acceptance);
    $('filters').before(explanation);
    $('disclosure').setAttribute('required', '');
    $('disclosure').setAttribute('aria-describedby', 'gift-disclosure');
    $('disclosure').onchange = e => { disclosureAccepted = e.target.checked; $('primary').disabled = serverMode ? !checkoutReady() : !deliveryValid(session) || !disclosureAccepted; if (journeyDemo)
        rememberPivotReview(); };
    primary(journeyDemo ? 'Preview Payment' : 'Continue to Payment', () => { paymentState = 'blocked'; go('payment'); }, !deliveryValid(session) || !disclosureAccepted || !session.lines.length);
}
const layoutViews = ['photo', 'products', 'configuration', 'cart', 'checkout', 'payment-loading', 'payment-pending', 'payment-failed', 'payment-verified', 'auth', 'restoring', 'restore-failed', 'effects', 'gallery', 'gallery-second', 'approval', 'approval-second', 'approval-final', 'approval-loading', 'approval-failed'];
const layoutName = params.get('layoutReview') || '';
const layoutReview = layoutViews.some(v => v === layoutName);
const journeyDemo = layoutReview && params.get('journey') === '1';
let demoItems = [], demoAccepted = false;
const scenePictures = new Map();
const scenePending = new Set();
const sceneFailures = new Set();
let pivotMode = layoutReview ? params.get('pivot') === '1' : params.get('fixture') !== '1';
function pivotSubjectCount() { return layoutReview ? Number(params.get('subjects') || '1') : live?.session?.source.series === 'groups' ? live.session.source.peopleCount || 0 : 1; }
const pivotKey = 'gift-pivot-review:' + fixtureSeries + ':' + params.get('subjects') + (journeyDemo ? ':journey' : '');
let disclosureAccepted = false, paymentState = 'blocked';
const restoration = new RequestSlot();
const serverMode = !layoutReview && params.get('fixture') !== '1';
// Navigation hints only; authentication and all artwork/payment data are restored from the server.
const resumeKey = 'liten-gift-resume';
function readResume() { try {
    return JSON.parse(sessionStorage.getItem(resumeKey) || 'null');
}
catch {
    return null;
} }
let compositionRequestPending = false;
let compositionTimer;
let compositionReadPending = false;
const compositionStarts = new Set();
let compositionResume = null;
let restorationComplete = false;
function rememberView() {
    if (!serverMode || !restorationComplete || !live?.session)
        return;
    if (activeProduct && Number.isInteger(copies) && copies >= 1 && copies <= 20)
        productDrafts[activeProduct] = { size, copies };
    try {
        sessionStorage.setItem(resumeKey, JSON.stringify({ sessionId: live.id, view, studioState, productDrafts, effectIds: session.effectIds, recipient: session.recipient, silo, mobileSilo, artFocus, batchIndex, featuredProduct, productReviewIndex, history, generationBatch, batchIntent, activeProduct, size, copies, editId }));
    }
    catch { }
}
function restoreView(s) {
    const savedResume = readResume(), hint = savedResume?.sessionId === s.sessionId ? savedResume : null;
    restorationComplete = true;
    const u = new URL(location.href);
    u.searchParams.set('sessionId', s.sessionId);
    window.history.replaceState(null, '', u);
    const incomplete = s.batches.find(b => !b.complete);
    generationBatch = incomplete?.batchIndex ?? null;
    if (generationBatch) {
        view = 'review';
        if (hint?.batchIntent && typeof hint.batchIntent.idempotencyKey === 'string' && Array.isArray(hint.batchIntent.effectIds))
            batchIntent = hint.batchIntent;
        scheduleGenerationRead();
    }
    if (s.order.state === 'approved') {
        view = 'compositions';
        orderReviewExample = true;
        return;
    }
    if (s.entrance === 'collection' && !purchased(s))
        view = 'products';
    if (s.flow === 'generations' && !purchased(s)) {
        const latest = s.generations?.items.at(-1);
        if (latest) {
            selectedGenerationId = latest.generationId;
            const split = latest.productId.lastIndexOf(':');
            studioState.productId = latest.productId.slice(0, split);
            studioState.size = latest.productId.slice(split + 1);
            studioState.step = 'review';
            view = 'generation';
            scheduleProductGenerationRead();
        }
        else if (s.generations?.effectId)
            view = 'products';
    }
    if (!hint)
        return;
    session.effectIds = s.flow === 'generations' ? session.effectIds : Array.isArray(hint.effectIds) ? hint.effectIds.filter((id) => typeof id === 'string' && effects().some(e => e.id === id) && !s.usedEffectIds.includes(id)).slice(0, 6) : [];
    if (recipientOptions.includes(hint.recipient))
        session.recipient = hint.recipient;
    if (registry().silos.some(x => x.id === hint.silo))
        silo = hint.silo;
    if (registry().silos.some(x => x.id === hint.mobileSilo))
        mobileSilo = hint.mobileSilo;
    if (session.batches.flat().some(p => p.id === hint.artFocus))
        artFocus = hint.artFocus;
    if (Number.isInteger(hint.batchIndex) && session.batches[hint.batchIndex])
        batchIndex = hint.batchIndex;
    if (products.some(p => p.id === hint.featuredProduct))
        featuredProduct = hint.featuredProduct;
    if (Number.isInteger(hint.productReviewIndex) && hint.productReviewIndex >= 0 && hint.productReviewIndex < session.lines.length)
        productReviewIndex = hint.productReviewIndex;
    for (const p of products) {
        const d = hint.productDrafts?.[p.id];
        if (d && p.options.some(o => o.size === d.size) && Number.isInteger(d.copies) && d.copies >= 1 && d.copies <= 20)
            productDrafts[p.id] = { size: d.size, copies: d.copies };
    }
    if (hint.studioState && ['product', 'size', 'options', 'review'].includes(hint.studioState.step) && products.some(p => p.id === hint.studioState.productId)) {
        studioState = { ...hint.studioState, drafts: productDrafts };
    }
    const configured = products.find(p => p.id === hint.activeProduct);
    if (configured?.available && configured.options.some(o => o.size === hint.size)) {
        activeProduct = configured.id;
        size = hint.size;
        copies = Number.isInteger(hint.copies) && hint.copies >= 1 && hint.copies <= 20 ? hint.copies : 1;
        editId = session.lines.some(l => l.id === hint.editId) ? hint.editId : null;
    }
    const allowed = ['acceptance', 'generation', 'photo', 'effects', 'review', 'focus', 'compare', 'more', 'products', 'configuration', 'cart', 'checkout', 'compositions'];
    history = Array.isArray(hint.history) ? hint.history.filter((v) => allowed.includes(v)) : [];
    if (generationBatch)
        view = 'review';
    else if (allowed.includes(hint.view) && (!pivotMode || ['photo', 'effects', 'products', 'generation', 'acceptance', 'cart', 'checkout'].includes(hint.view)))
        go(hint.view, false);
}
window.addEventListener('pagehide', () => { rememberView(); clearTimeout(generationTimer); clearTimeout(productGenerationTimer); });
window.addEventListener('pageshow', e => { if (e.persisted && serverMode) {
    view = 'payment';
    void retryRestoration();
} });
let live = serverMode && params.get('sessionId') ? new LiveGift(new GiftBackend((url, init) => fetch(url, init)), params.get('sessionId')) : null;
let entryGifts = [];
let entrySignedIn = false, entryFailed = false;
const paidGift = (s) => !!s.order.orderId && !['none', 'checkout_open', 'cancelled'].includes(s.order.state);
function entryCard(g, paid) {
    const d = g.detail, art = d?.generations?.items.filter(x => x.status === 'ready' && x.url).at(-1)?.url || d?.batches.flatMap(b => b.previews).find(p => p.previewId === d.artworkPreviewId)?.url;
    const line = d?.lines[0], productId = line?.productId || d?.generations?.items.at(-1)?.productId, product = products.find(p => p.id === productId?.split(':')[0]);
    return '<article class="gift-entry-card"><div class="gift-entry-images">' + (d?.source.photoUrl ? photo(d.source.photoUrl, 'Source photo') : '') + (art ? photo(art, 'Your artwork') : '') + (product ? photo(beautyPhoto(product), product.label) : '') + '</div><h3>' + esc(product?.label || g.series || 'Gift') + '</h3><p class="small">' + esc(g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '') + (paid ? ' · ' + esc(d?.order.state.replace(/_/g, ' ') || '') : '') + '</p><div class="actions"><button type="button" data-resume-gift="' + esc(g.sessionId) + '">' + (paid ? 'View Gift' : 'Continue Gift') + '</button>' + (!paid && d ? '<button type="button" data-delete-gift="' + esc(g.sessionId) + '">Delete</button>' : '') + '</div></article>';
}
function renderEntry() {
    const account = params.get('account') === 'gifts';
    rail(account ? 'Your<br>Account' : 'Your<br>Gift', '');
    $('back').hidden = true;
    $('screen').innerHTML = account ? '<h2>Paid Gifts</h2><div class="gift-entry-list">' + entryGifts.filter(g => g.detail && paidGift(g.detail)).map(g => entryCard(g, true)).join('') + '</div>' : '<div class="gift-entry-intro"><p class="eyebrow">A MORE MEANINGFUL GIFT</p><h2>Start a New Gift</h2><p>Turn a favorite photo into a gift they’ll treasure.</p>' + secondary('start-new-gift', 'Start a New Gift') + '</div>';
    if ($('start-new-gift'))
        $('start-new-gift').onclick = () => location.assign('/gift-wizard.next.html?newGift=1');
    const drafts = entryGifts.filter(g => g.detail && !paidGift(g.detail));
    $('right').innerHTML = account ? '<h2>Your Account</h2><a class="entry-account" href="/account">Account</a><a class="entry-account" href="/gift-wizard.next.html">Previous Gifts in Progress</a>' : '<h2>Previous Gifts in Progress</h2>';
    const content = busy ? '<p role="status">Checking your account…</p>' : entryFailed ? secondary('retry-entry', 'Try again') : !entrySignedIn ? secondary('entry-signin', 'Sign in') : account ? '' : !drafts.length ? '<p>No gifts in progress.</p>' : '<div class="gift-entry-list">' + drafts.map(g => entryCard(g, false)).join('') + '</div>';
    $('right').insertAdjacentHTML('beforeend', content);
    if (!account && entrySignedIn)
        $('right').insertAdjacentHTML('beforeend', '<a class="entry-account" href="/gift-wizard.next.html?account=gifts">Paid Gifts in Your Account</a>');
    for (const button of document.querySelectorAll('[data-resume-gift]'))
        button.onclick = () => location.assign('/gift-wizard.next.html?sessionId=' + encodeURIComponent(button.dataset.resumeGift));
    for (const button of document.querySelectorAll('[data-delete-gift]'))
        button.onclick = () => confirmStageAction('Delete This Gift', 'Delete this unpaid draft and its photo and previews? Artwork in My Collection and paid gifts are not changed.', 'Delete', () => void deleteEntryGift(button.dataset.deleteGift));
    if ($('entry-signin'))
        $('entry-signin').onclick = () => window.LitenAuth.open('/gift-wizard.next.html' + (account ? '?account=gifts' : ''));
    if ($('retry-entry'))
        $('retry-entry').onclick = () => void loadGiftEntry();
}
async function deleteEntryGift(id) {
    if (busy)
        return;
    busy = true;
    render();
    try {
        const api = new GiftBackend((url, init) => fetch(url, init));
        const latest = await api.restore(id);
        if (paidGift(latest) || !['none', 'checkout_open'].includes(latest.order.state))
            throw Error('Paid gifts cannot be deleted here.');
        await api.deleteDraft(id);
        entryGifts = entryGifts.filter(g => g.sessionId !== id);
    }
    catch (e) {
        busy = false;
        render();
        error(e instanceof Error ? e.message : 'Gift could not be deleted.');
        return;
    }
    busy = false;
    render();
}
async function loadGiftEntry() {
    live = null;
    restorationComplete = false;
    clearTimeout(generationTimer);
    clearTimeout(productGenerationTimer);
    pivotMode = true;
    view = 'entry';
    busy = true;
    entryGifts = [];
    entrySignedIn = false;
    entryFailed = false;
    render();
    try {
        const api = new GiftBackend((url, init) => fetch(url, init)), latest = await api.restoreLatest();
        entrySignedIn = true;
        entryGifts = latest.recent.map(g => ({ ...g }));
        if (latest.current && !entryGifts.some(g => g.sessionId === latest.current.sessionId))
            entryGifts.unshift({ sessionId: latest.current.sessionId, series: latest.current.source.series, createdAt: undefined });
        await Promise.all(entryGifts.map(async (g) => { try {
            g.detail = latest.current?.sessionId === g.sessionId ? latest.current : await api.restore(g.sessionId);
        }
        catch { } }));
    }
    catch (e) {
        entryFailed = !(e instanceof GiftApiError && e.status === 401);
    }
    finally {
        busy = false;
        view = 'entry';
        render();
    }
}
async function retryRestoration() {
    if (!params.get('sessionId') && params.get('newGift') !== '1' && !params.has('gift_order_session') && !params.has('gift_pack_session')) {
        await loadGiftEntry();
        return;
    }
    restorationComplete = false;
    clearTimeout(generationTimer);
    paymentState = 'restoring';
    view = live?.session ? 'payment' : 'photo';
    busy = true;
    render();
    let suggestedView = null;
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
        if (!live) {
            if (params.get('newGift') === '1') {
                const auth = await fetch('/api/v1/auth/me', { credentials: 'same-origin', cache: 'no-store', signal });
                if (!auth.ok)
                    throw new GiftApiError(auth.status === 401 ? 'sign_in_required' : 'request_failed', auth.status);
                return null;
            }
            const api = new GiftBackend((url, init) => fetch(url, init)), hint = readResume();
            if (hint?.sessionId && /^[\w-]{1,80}$/.test(hint.sessionId)) {
                try {
                    const saved = await api.restore(hint.sessionId, signal);
                    if (saved.sessionId !== hint.sessionId)
                        throw new GiftApiError('session_identity_mismatch', 0);
                    live = new LiveGift(api, saved.sessionId);
                    live.accept(saved);
                    view = 'payment';
                    render();
                }
                catch (e) {
                    if (!(e instanceof GiftApiError && e.status === 404))
                        throw e;
                }
            }
            if (!live) {
                const latest = await api.restoreLatest(signal);
                if (!latest.current)
                    return null;
                live = new LiveGift(api, latest.current.sessionId);
                live.accept(latest.current);
                view = 'payment';
                render();
                compositionResume = latest.resume?.compositions || null;
                const step = latest.resume.suggestedStep;
                suggestedView = step === 'previews' ? 'review' : step === 'order' ? 'payment' : step;
            }
        }
        await live.restore(signal);
        return live.session;
    });
    const state = restoration.state;
    busy = false;
    if (state.status === 'ready') {
        if (!state.value) {
            pivotMode = true;
            live = null;
            session = newSession();
            sourceURL = '';
            generationBatch = null;
            restorationComplete = false;
            view = 'photo';
            await syncCatalog();
            render();
            return;
        }
        try {
            await syncCatalog();
            applyServer(state.value);
            await loadMockups();
            paymentState = purchased(state.value) ? 'payment-verified' : 'pending';
            view = state.value.order.state === 'none' ? (session.batches.length ? 'review' : 'effects') : 'payment';
            if (suggestedView)
                view = suggestedView;
            restoreView(state.value);
            render();
            void resumeStalledBatches();
            await resumeCompositionWork(true);
        }
        catch (e) {
            live?.clear();
            paymentState = 'restore-failed';
            render();
            error(e instanceof Error ? e.message : 'request_failed');
        }
    }
    else {
        view = 'payment';
        restorationComplete = false;
        paymentState = state.status === 'failed' && state.httpStatus === 401 ? 'auth' : state.status === 'failed' && state.code === 'payment_pending' ? 'pending' : 'restore-failed';
        render();
        if (state.status === 'failed')
            error(state.code);
    }
}
function renderDemoPayment() {
    pivotRail('Checkout');
    $('screen').innerHTML = '<h2>Payment</h2><p class="development-note">Development demonstration — payment fields below do not submit a charge. Do not enter real card details.</p><div class="address">' + field('demo-card', 'Test card number', '4242 4242 4242 4242', 'readonly') + field('demo-expiry', 'Expiry', '12 / 30', 'readonly') + field('demo-cvc', 'Security code', '123', 'readonly') + '</div>';
    $('right').innerHTML = '<h2>Order summary</h2>' + session.lines.map(l => lineMarkup(l, false)).join('') + '<p>Products ' + money(productSubtotal(session, products)) + '</p><p class="small">Shipping and tax are quoted by the live checkout.</p>';
    primary('View Completion Example', () => go('complete'));
    $('back').disabled = false;
    $('back').onclick = () => go('checkout');
}
function renderPayment() {
    if (journeyDemo) {
        renderDemoPayment();
        return;
    }
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
    session.lines = (['photo', 'effects', 'gallery', 'gallery-second', 'products'].includes(layoutName) ? [] : ['framed', 'canvas']).map((id, i) => { const p = products.find(p => p.id === id); return { id: 'layout-' + i, productId: id, size: p.options.find(o => o.size === '12x18')?.size || p.options[0]?.size || '', copies: 1 }; });
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
// Keep the source object URL valid for browser Back/forward cache restoration.
async function start() {
    try {
        const [c, f, m, samples, original] = await Promise.all([fetch(asset('./catalog.next.json')), serverMode ? Promise.resolve(new Response('[]', { status: 200 })) : fetch(asset('./fixtures.next.json')), fetch(asset('./effect-previews/index.next.json')), fetch(asset('./catalog-samples/index.next.json')).catch(() => null), fetch('/previews/effects-manifest.json').catch(() => null)]);
        if (!c.ok || !f.ok || !m.ok)
            throw Error();
        const catalog = await c.json();
        products = catalog.products;
        limit = catalog.maxUploadBytes;
        fixtures = await f.json();
        manifest = await m.json();
        if (original?.ok)
            originalPortraitManifest = await original.json();
        if (samples?.ok) {
            const sampleIndex = await samples.json();
            if (sampleIndex.version === 1)
                catalogSamples = sampleIndex.series || {};
        }
        for (const [series, path] of [['portraits', '/effect-registry.js'], ['groups', '/groups-registry.js'], ['pets', '/pets-registry.js']]) {
            await import(path);
            registries[series] = window.EFFECT_REGISTRY;
        }
        initializeLayoutReview();
        if (pivotMode && layoutReview) {
            restorePivotReview();
            pivotRestored = true;
        }
        render();
        if (serverMode) {
            view = 'payment';
            await retryRestoration();
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
    const availability = live ? await api.availability(live.id) : null;
    productAvailability.clear();
    for (const p of availability?.products || [])
        productAvailability.set(p.productId, p);
    unavailableCatalogOptions.clear();
    for (const p of catalog.products.filter(p => p.status !== 'launch' || p.retailCents === null)) {
        const list = unavailableCatalogOptions.get(p.family) || [];
        list.push({ label: p.label, reason: (p.disabledReason || 'retail_price_pending').replace(/_/g, ' ') });
        unavailableCatalogOptions.set(p.family, list);
    }
    productPhotography.clear();
    if (availability) {
        const sceneIds = [...new Set(availability.products.map(p => p.preview?.sceneId).filter((id) => !!id))];
        await Promise.all(sceneIds.map(async (id) => { try {
            const r = await fetch('/gift-wizard/mockup-scenes/' + encodeURIComponent(id) + '/scene.next.json');
            if (!r.ok)
                return;
            const d = await r.json();
            if (d.id !== id || typeof d.sourceImage !== 'string' || d.sourceImage.includes('/') || d.sourceImage.includes('\\'))
                return;
            for (const p of availability.products.filter(p => p.preview?.sceneId === id && isApprovedScene(p.productId, id)))
                productPhotography.set(p.productId, '/gift-wizard/mockup-scenes/' + encodeURIComponent(id) + '/' + encodeURIComponent(d.sourceImage));
        }
        catch { } }));
    }
    const allowed = (id, fallback) => availability ? availability.products.find(p => p.productId === id)?.purchasable === true : fallback;
    const offeredOrientation = (c) => { if (!availability?.orientations)
        return true; const configuration = productAvailability.get(c.productId)?.configuration; if (configuration?.skuOrientation === 'wrap' || configuration?.skuOrientation === 'spread')
        return allowed(c.productId, c.selectable); const px = c.requirements.picturePx; const orientation = px.w === px.h ? 'square' : px.w > px.h ? 'landscape' : 'portrait'; const entry = availability.orientations[orientation]; return entry?.supported === true && entry.productIds?.includes(c.productId) === true; };
    products = products.map(p => ({ ...p, available: catalog.products.some(c => c.family === p.id && allowed(c.productId, c.selectable)), options: catalog.products.filter(c => c.family === p.id && c.status === 'launch' && c.retailCents !== null && offeredOrientation(c)).map(c => ({ sku: c.sku, size: c.size, family: c.family, label: c.label, retailCents: c.retailCents, attributes: c.attributes, compatible: allowed(c.productId, c.selectable) && (live?.session?.flow !== 'generations' || productAvailability.get(c.productId)?.generation?.supported !== false), imageWidthIn: c.requirements.picturePx.w / c.requirements.ppi, imageHeightIn: c.requirements.picturePx.h / c.requirements.ppi, requiredPx: c.requirements.finalPx, familyNote: productAvailability.get(c.productId)?.generation?.supported === false ? productAvailability.get(c.productId).generation.reason.replace(/_/g, ' ') : c.note })) }));
}
function applyServer(s) {
    pivotMode = s.flow === 'generations' && !purchased(s);
    sourceURL = s.source.photoUrl || (session.sessionId === s.sessionId ? sourceURL : '');
    const lines = s.lines.map(l => {
        const split = l.productId.lastIndexOf(':'), family = l.productId.slice(0, split);
        const p = products.find(p => p.id === family), o = p?.options.find(o => o.size === l.size);
        const g = s.geometries.find(g => g.lineId === l.lineId);
        if (!p || !o || !g || g.productId !== l.productId || g.sku !== o.sku || g.requiredPx.w !== o.requiredPx.w || g.requiredPx.h !== o.requiredPx.h)
            throw new GiftApiError('purchased_configuration_mismatch', 0);
        return { id: l.lineId, productId: family, size: l.size, copies: l.copies, generationId: l.generationId };
    });
    session.sessionId = s.sessionId;
    session.source = { status: 'supported', series: s.source.series, sourceRef: s.source.sourceRef, fixture: false };
    session.lines = lines;
    session.favoriteId = s.artworkPreviewId;
    shoppingFavoriteId = null;
    session.effectIds = s.flow === 'generations' ? (s.generations?.effectId ? [s.generations.effectId] : []) : session.effectIds.filter(id => !s.usedEffectIds.includes(id));
    session.batches = s.batches.filter(b => b.previews.some(p => p.status === 'ready' && p.url)).map(b => b.previews.filter(p => p.status === 'ready' && p.url && p.width && p.height).map(p => ({ id: p.previewId, url: p.url, label: effects().find(e => e.id === p.effectId)?.label || p.effectId, width: p.width, height: p.height, watermark: 'baked', fixture: false })));
    const retained = session.batches.findIndex(b => b.some(p => p.id === artFocus));
    const selected = session.batches.findIndex(b => b.some(p => p.id === s.artworkPreviewId));
    batchIndex = retained >= 0 ? retained : selected >= 0 ? selected : Math.max(0, session.batches.length - 1);
    artFocus = session.batches[batchIndex]?.find(p => p.id === artFocus)?.id || session.batches[batchIndex]?.find(p => p.id === s.artworkPreviewId)?.id || session.batches[batchIndex]?.[0]?.id || '';
}
async function serverAction(action, next) {
    if (!live || busy)
        return;
    serverMutation++;
    busy = true;
    render();
    if (view === 'effects' && pivotMode) {
        $('primary').textContent = 'Choosing Your Effect…';
        $('primary').setAttribute('aria-busy', 'true');
    }
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
function compositionStartKey() { const s = live?.session; return s ? 'liten-gift-compose:' + s.sessionId + ':' + s.artworkPreviewId + ':' + s.compositions.map(c => c.lineId + ':' + c.state + ':' + c.attempts).sort().join('|') : ''; }
function scheduleCompositionRead() {
    clearTimeout(compositionTimer);
    if (live?.session?.order.state === 'awaiting_artwork' && (compositionRequestPending || live.session.compositions.some(c => c.state === 'preparing')))
        compositionTimer = setTimeout(() => void readCompositionState(), 3000);
}
async function readCompositionState(resume = true) {
    const owner = live;
    if (!owner || compositionReadPending)
        return;
    compositionReadPending = true;
    try {
        const s = await owner.api.restore(owner.id);
        if (live !== owner)
            return;
        owner.accept(s);
        applyServer(s);
        await loadMockups();
        render();
        if (!compositionRequestPending)
            await resumeCompositionWork(true);
    }
    catch (e) {
        error(e instanceof Error ? e.message : 'request_failed');
    }
    finally {
        compositionReadPending = false;
        scheduleCompositionRead();
    }
}
async function resumeCompositionWork(openReview = false) {
    const s = live?.session;
    if (!s || s.order.state !== 'awaiting_artwork' || !s.artworkPreviewId || !s.compositions.length || layoutReview)
        return;
    if (!s.compositions.every(c => c.state))
        return;
    if (openReview) {
        view = 'compositions';
        render();
    }
    if (s.compositions.some(c => c.state === 'preparing') || compositionRequestPending) {
        scheduleCompositionRead();
        return;
    }
    if (s.compositions.some(c => c.state === 'failed'))
        return;
    const unfinished = s.compositions.some(c => c.state === 'not_started' || c.state === 'stalled');
    const needed = unfinished && (compositionResume?.resumeNeeded || unfinished);
    compositionResume = null;
    if (!needed)
        return;
    await serverAction(() => composePurchasedArtwork(), 'compositions');
}
async function composePurchasedArtwork(explicitRetry = false) {
    if (compositionRequestPending)
        return live.session;
    const s = live.session;
    if (s.order.state !== 'awaiting_artwork')
        throw new GiftApiError('order_payment_required', 409);
    if (s.compositions.some(c => c.state === 'preparing')) {
        scheduleCompositionRead();
        return s;
    }
    const key = compositionStartKey();
    if (!explicitRetry) {
        if (compositionStarts.has(key))
            return s;
        try {
            if (sessionStorage.getItem(key))
                return s;
        }
        catch { }
    }
    compositionStarts.add(key);
    try {
        sessionStorage.setItem(key, 'requested');
    }
    catch { }
    compositionRequestPending = true;
    view = 'compositions';
    render();
    scheduleCompositionRead();
    try {
        return await live.api.compose(live.id);
    }
    finally {
        compositionRequestPending = false;
        scheduleCompositionRead();
    }
}
async function loadMockups() {
    if (!live?.session || !purchased(live.session))
        return;
    await Promise.all(live.session.compositions.filter(c => (!c.state || ['ready', 'approved'].includes(c.state)) && c.compositionId && c.sourceArtworkId === live.session.artworkPreviewId).map(c => live.mockup(c.lineId).catch(() => null)));
}
function serverMockup(l) {
    const c = live?.session?.compositions.find(c => c.lineId === l.id);
    if (c?.state === 'failed')
        return '<section role="alert"><h2>Didn’t finish</h2></section>' + secondary('retry-preparation-' + l.id, c.retryable ? 'Try again' : 'Concierge');
    if (c?.state === 'not_started' && !compositionRequestPending)
        return '<section role="status"><h2>Product artwork review</h2></section>' + secondary('retry-preparation-' + l.id, 'Try again');
    if (c?.state === 'stalled')
        return '<section role="status"><h2>Preparing Your Masterpiece</h2></section>' + secondary('check-composition-' + l.id, 'Check Again');
    if (c?.state === 'preparing' || (compositionRequestPending && !c?.compositionId))
        return '<section role="status"><h2>Preparing Your Masterpiece</h2>' + (favorite() ? photo(favorite().url, 'Selected artwork') : '') + '</section>';
    if (live?.compositionIssues.has(l.id))
        return "<section role=\"status\" data-composition-state=\"repair-required\"><h3>We're preparing your artwork for this gift</h3><p>Your artwork needs a small adjustment to fit this product correctly. We're taking care of it.</p><p>Your selected artwork and purchase are safe. No action is needed right now.</p></section>" + secondary('check-composition-' + l.id, 'Check Again');
    if (live?.unavailableScenes.has(l.id))
        return '<p role="status">Not currently available</p>';
    const m = live?.mockups.get(l.id);
    return m && Date.parse(m.urlExpiresAt) > Date.now() ? photo(m.url, giftOption(l, products).product.label) + (m.renderer === 'artwork' ? '<p class="small">' + esc(m.disclosure) + '</p>' : '') : '<p role="status">This product preview could not load.</p>' + secondary('refresh-mockups', 'Try again');
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
                    busy = false;
                    render();
                    window.LitenAuth.open('/gift-wizard.next.html' + location.search);
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
        } void serverAction(() => composePurchasedArtwork(), 'compositions'); }, s.order.state !== 'awaiting_artwork');
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
    if (view === 'effects' && !pivotMode) {
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
    if (['review', 'focus', 'compare'].includes(view) && !generationBatch) {
        if ($('another-batch')) {
            $('another-batch').disabled = !canCraft(s) && s.nextBatch.kind !== 'payment_required';
            if (s.nextBatch.kind === 'paid')
                $('another-batch').textContent = 'Craft My Six Previews';
            if (s.nextBatch.kind === 'payment_required')
                $('another-batch').textContent = 'Six More · $2.99';
            $('another-batch').onclick = s.nextBatch.kind === 'payment_required' ? () => go('more') : () => go('effects');
        }
        if ($('compare'))
            $('compare').disabled = session.batches[batchIndex].length < 2;
    }
    if (!pivotMode && ['effects', 'review', 'focus', 'compare'].includes(view) && !generationBatch) {
        const incomplete = s.batches.find(b => !b.complete);
        if (incomplete) {
            $('right').insertAdjacentHTML('beforeend', secondary('retry-batch', 'Try again'));
            $('retry-batch').onclick = () => void serverAction(async () => { const r = await live.api.retryBatch(live.id, incomplete.batchIndex); return r.session; }, 'review');
        }
    }
    if (view === 'compositions') {
        document.querySelectorAll('[id^="retry-preparation-"]').forEach(b => { b.disabled = busy; b.onclick = () => { const c = s.compositions.find(c => c.lineId === b.id.slice('retry-preparation-'.length)); if (c?.state === 'not_started' || (c?.state === 'failed' && c.retryable))
            void serverAction(() => composePurchasedArtwork(true), 'compositions');
        else
            location.assign('/help'); }; });
        document.querySelectorAll('[id^="check-composition-"]').forEach(b => { b.disabled = busy; b.onclick = () => void readCompositionState(false); });
        if (orderReviewExample) {
            $('right').querySelectorAll('p.small').forEach(el => el.textContent = '');
            $('screen').querySelectorAll('.cart-line').forEach((el, i) => { const c = s.compositions.find(c => c.lineId === session.lines[i]?.id); const note = el.querySelector('.cart-details .small'); const disclosure = el.querySelector('.cart-thumbnail .small'); if (disclosure)
                el.querySelector('.cart-details')?.append(disclosure); if (note)
                note.textContent = live.compositionIssues.has(session.lines[i]?.id) ? 'Awaiting server verification' : c?.state || c?.status || ''; });
            const complete = s.order.state === 'approved';
            if (complete) {
                $('screen').querySelector('h2').textContent = 'Your gifts are approved';
                $('right').querySelector('h2').textContent = 'Final artwork approval complete';
                $('right').querySelector('p').textContent = 'Your approval is recorded. Manufacturing is handled separately.';
                $('review-products').hidden = true;
                primaryLive(() => location.assign('/collection?from=' + s.source.series), false);
                $('primary').textContent = 'My Collection →';
            }
            else {
                const eligible = s.order.state === 'awaiting_artwork' && s.lines.length > 0 && s.lines.every(l => s.compositions.some(c => c.lineId === l.lineId && c.productId === l.productId && c.sourceArtworkId === s.artworkPreviewId && c.status === 'approved' && (!c.state || c.state === 'approved')) && !live.compositionIssues.has(l.lineId) && !!live.mockups.get(l.lineId) && Date.parse(live.mockups.get(l.lineId).urlExpiresAt) > Date.now());
                primaryLive(() => void serverAction(() => live.api.finalize(live.id), 'compositions'), !eligible);
            }
        }
        if ($('refresh-mockups'))
            $('refresh-mockups').onclick = () => void serverAction(() => live.compositionIssues.size || s.compositions.some(c => c.lineId === session.lines[productReviewIndex]?.id && c.compositionId) ? live.api.restore(live.id) : composePurchasedArtwork(), 'compositions');
        if (!orderReviewExample && session.lines.length) {
            const line = session.lines[productReviewIndex], c = s.compositions.find(c => c.lineId === line?.id);
            const label = $('right').querySelector('h3');
            if (label?.nextElementSibling)
                label.nextElementSibling.textContent = live.compositionIssues.has(line.id) ? 'Awaiting server verification' : c?.state || c?.status || '';
            const correction = $('right').querySelector('button');
            if (correction) {
                correction.disabled = busy || live.compositionIssues.has(line.id) || (!!c?.state && !['ready', 'approved'].includes(c.state)) || !c?.compositionId || !c.correctionsRemaining || s.order.state !== 'awaiting_artwork';
                correction.onclick = () => void serverAction(() => live.api.correct(live.id, line.id), 'compositions');
            }
            const m = live.mockups.get(line.id);
            if (m) {
                const img = $('screen').querySelector('img');
                if (img)
                    img.addEventListener('error', () => { live.mockups.delete(line.id); render(); }, { once: true });
            }
            primaryLive(() => void serverAction(() => live.api.approveComposition(live.id, c.compositionId), 'compositions'), live.compositionIssues.has(line.id) || !c?.compositionId || c.status !== 'ready' || (c.state !== undefined && c.state !== 'ready') || !m || !(Date.parse(m.urlExpiresAt) > Date.now()) || s.order.state !== 'awaiting_artwork');
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
