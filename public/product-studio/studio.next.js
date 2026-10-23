const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
export const aspect = (o) => o.imageWidthIn === o.imageHeightIn ? 'Square' : o.imageWidthIn > o.imageHeightIn ? 'Landscape' : 'Portrait';
const dimensions = (o) => o.imageWidthIn + ':' + o.imageHeightIn;
export function optionChoices(p, o) { return p.options.filter(x => dimensions(x) === dimensions(o)); }
export function hasChoices(p, o) { return optionChoices(p, o).filter(x => x.compatible !== false).length > 1; }
const photo = (url, label) => '<img src="' + esc(url) + '" alt="' + esc(label) + '">';
export function familyPhoto(p) { return { premium: '/gift-wizard/mockup-scenes/premium-square/premium fine art print square.png', framed: '/gift-wizard/mockup-scenes/classic-framed-square/classic framed print square.png' }[p.id] || p.image; }
export function unavailableStudio(host, onExit) { host.innerHTML = '<section class="studio-panel"><button type="button">← Back</button><p role="status">Not currently available</p></section>'; host.querySelector('button').onclick = onExit; }
export function unavailablePreview(p) { return photo(p.image, p.label) + '<p role="status">Not currently available</p>'; }
export function mountStudio(host, a) {
    const s = a.state;
    if (!['product', 'size', 'options', 'review'].includes(s.step))
        s.step = 'product';
    if (!a.products.some(p => p.id === s.productId)) {
        s.productId = a.products[0]?.id || '';
        s.step = 'product';
    }
    host.innerHTML = '<section class="product-studio" aria-label="Product Studio"><div class="studio-media"></div><section class="studio-panel" aria-live="polite"></section></section>';
    const panel = host.querySelector('.studio-panel'), media = host.querySelector('.studio-media');
    function commit() { if (s.productId)
        s.drafts[s.productId] = { size: s.size, copies: s.copies }; a.onChange(s); }
    function advance(step) { s.step = step; commit(); draw(); panel.querySelector('h2')?.focus({ preventScroll: true }); }
    function back() {
        const p = a.products.find(p => p.id === s.productId), o = p.options.find(o => o.size === s.size);
        if (s.step === 'product') {
            a.onExit();
            return;
        }
        advance(s.step === 'review' && o && hasChoices(p, o) ? 'options' : s.step === 'options' || s.step === 'review' ? 'size' : 'product');
    }
    function draw() {
        const p = a.products.find(p => p.id === s.productId);
        if (!p)
            return;
        if (!p.options.some(o => o.size === s.size))
            s.size = p.options.find(o => o.compatible !== false)?.size || p.options[0]?.size || '';
        const o = p.options.find(o => o.size === s.size);
        media.innerHTML = a.detailsHtml && s.step !== 'product' ? a.detailsHtml(p, o) : s.step === 'review' && p.available && o ? a.previewHtml(p, o) : photo(p.image, p.label);
        let body = '';
        if (s.step === 'product') {
            body = '<h2 tabindex="-1">Choose a Product</h2><div class="studio-products">' + a.products.map(x => '<button type="button" data-feature="' + esc(x.id) + '" aria-pressed="' + (x.id === s.productId) + '">' + photo(x.image, x.label) + '<span>' + esc(x.label) + '</span><small>' + (x.available && x.options.length ? 'From ' + money(Math.min(...x.options.map(o => o.retailCents))) : 'Not currently available') + '</small></button>').join('') + '</div>';
        }
        else if (!p.available || !o) {
            body = '<h2 tabindex="-1">' + esc(p.label) + '</h2><p role="status">Not currently available</p>' + (p.unavailableOptions || []).map(x => '<p class="small">' + esc(x.label) + ' · ' + esc(x.reason) + '</p>').join('');
        }
        else if (s.step === 'size') {
            const sizes = p.options.filter((x, i, all) => aspect(x) === aspect(o) && all.findIndex(y => dimensions(y) === dimensions(x)) === i);
            body = '<h2 tabindex="-1">' + esc(p.label) + '</h2>' + (a.detailsIntroHtml ? a.detailsIntroHtml(p, o) : '') + '<h3>Aspect ratio</h3><div class="sizes">' + [...new Set(p.options.map(aspect))].map(x => '<button data-aspect="' + x + '" aria-pressed="' + (aspect(o) === x) + '">' + x + '</button>').join('') + '</div><h3>' + esc(a.sizeHeading || 'Size') + '</h3><div class="sizes">' + sizes.map(x => '<button data-size="' + esc(x.size) + '" ' + (!optionChoices(p, x).some(y => y.compatible !== false) ? 'disabled ' : '') + 'aria-pressed="' + (dimensions(o) === dimensions(x)) + '">' + esc(x.label) + '</button>').join('') + '</div>';
        }
        else if (s.step === 'options') {
            const choices = optionChoices(p, o);
            const keys = [...new Set(choices.flatMap(x => Object.keys(x.attributes || {})))].filter(k => new Set(choices.map(x => x.attributes?.[k])).size > 1);
            body = '<h2 tabindex="-1">' + esc(p.label) + '</h2><p>' + esc(o.label) + '</p>' + keys.map(k => '<h3>' + esc(k === 'color' ? 'Finish' : k === 'wrap' ? 'Wrap' : k === 'mat' ? 'Matting' : k) + '</h3><div class="sizes">' + [...new Set(choices.map(x => x.attributes?.[k]).filter(Boolean))].map(v => '<button data-option-key="' + esc(k) + '" data-option-value="' + esc(v) + '" aria-pressed="' + (o.attributes?.[k] === v) + '" ' + (!choices.some(x => x.attributes?.[k] === v && x.compatible !== false) ? 'disabled' : '') + '>' + esc(v) + '</button>').join('') + '</div>').join('') + '<button class="primary" data-review>Personalized Review →</button>';
        }
        else {
            body = '<h2 tabindex="-1">' + esc(p.label) + '</h2><p>' + esc(o.label) + ' · ' + money(o.retailCents) + '</p><p>' + esc(Object.entries(o.attributes || {}).map(([k, v]) => k + ': ' + v).join(' · ')) + '</p><label class="field"><span>Quantity</span><input id="copies" type="number" min="1" max="20" step="1" value="' + s.copies + '"></label><button id="primary" class="primary" ' + (a.busy || !a.canAdd(p, o) ? 'disabled' : '') + '>' + esc(a.addLabel || 'Add to Cart') + ' →</button>';
        }
        a.navigationHost?.querySelector('#studio-back')?.remove();
        panel.innerHTML = '<div class="actions"><button type="button" id="studio-back">← Back</button></div>' + body + (a.utilityHtml || '');
        const backButton = panel.querySelector('#studio-back');
        backButton.onclick = back;
        if (a.navigationHost)
            a.navigationHost.insertBefore(backButton, a.navigationHost.querySelector('#new-gift'));
        host.querySelector('.product-studio').dataset.step = s.step;
        if (a.configurationHost) {
            if (s.step === 'product')
                host.querySelector('.product-studio').append(panel);
            else
                a.configurationHost.append(panel);
        }
        panel.querySelectorAll('[data-feature]').forEach(b => b.onclick = () => { commit(); s.productId = b.dataset.feature; const d = s.drafts[s.productId]; s.size = d?.size || ''; s.copies = d?.copies || 1; advance('size'); });
        panel.querySelectorAll('[data-aspect]').forEach(b => b.onclick = () => { const next = p.options.find(x => aspect(x) === b.dataset.aspect && x.compatible !== false) || p.options.find(x => aspect(x) === b.dataset.aspect); if (next) {
            s.size = next.size;
            commit();
            draw();
        } });
        panel.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { const selected = p.options.find(x => x.size === b.dataset.size); s.size = optionChoices(p, selected).find(x => x.compatible !== false).size; advance(hasChoices(p, selected) ? 'options' : 'review'); });
        panel.querySelectorAll('[data-option-key]').forEach(b => b.onclick = () => { const next = optionChoices(p, o).find(x => x.compatible !== false && x.attributes?.[b.dataset.optionKey] === b.dataset.optionValue); if (next) {
            s.size = next.size;
            commit();
            draw();
        } });
        const review = panel.querySelector('[data-review]');
        if (review)
            review.onclick = () => advance('review');
        const qty = panel.querySelector('#copies');
        if (qty)
            qty.oninput = () => { s.copies = Number(qty.value); commit(); const add = panel.querySelector('#primary'); add.disabled = !!a.busy || !Number.isInteger(s.copies) || s.copies < 1 || s.copies > 20 || !a.canAdd(p, o); };
        const add = panel.querySelector('#primary');
        if (add)
            add.onclick = () => { if (!a.busy && o && Number.isInteger(s.copies) && s.copies >= 1 && s.copies <= 20 && a.canAdd(p, o))
                a.onAdd(p, o, s.copies); };
    }
    draw();
    return { back, refresh: draw };
}
