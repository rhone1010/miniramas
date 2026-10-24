export class GiftApiError extends Error {
    code;
    status;
    details;
    constructor(code, status, details = null) {
        super(code);
        this.code = code;
        this.status = status;
        this.details = details;
    }
}
const segment = (s) => { if (!/^[\w-]{1,80}$/.test(s))
    throw new GiftApiError('invalid_reference', 0); return encodeURIComponent(s); };
const sessionPath = (id) => '/api/v1/gift/sessions/' + segment(id);
const record = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const previewURL = (url) => /^https:\/\//.test(url) || (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname) && url.startsWith(location.origin + '/'));
export function assertSession(v) {
    if (!record(v) || v.contractVersion !== 1 || typeof v.sessionId !== 'string' || !record(v.order) || !record(v.entitlement) || !record(v.nextBatch) || !Array.isArray(v.lines) || !Array.isArray(v.batches) || !Array.isArray(v.compositions))
        throw new GiftApiError('invalid_session_response', 0);
    if (v.entrance !== undefined && !['photo', 'collection'].includes(v.entrance))
        throw new GiftApiError('invalid_session_response', 0);
    if (v.entrance === 'collection' && (!record(v.collection) || typeof v.collection.previewId !== 'string' || typeof v.collection.portfolioId !== 'string' || !v.artworkPreviewId))
        throw new GiftApiError('invalid_session_response', 0);
    for (const n of [v.entitlement.freeBatchesTotal, v.entitlement.freeBatchesUsed, v.entitlement.paidPacksAvailable, v.order.freeBatchesGranted])
        if (!Number.isInteger(n) || n < 0)
            throw new GiftApiError('invalid_entitlement_response', 0);
    if (typeof v.entitlement.freeAvailable !== 'boolean' || ![null, 'session_limit', 'photo_limit', 'daily_limit', 'lifetime_limit'].includes(v.entitlement.freeBlockedReason))
        throw new GiftApiError('invalid_entitlement_response', 0);
    if (!['free', 'paid', 'payment_required', 'blocked'].includes(v.nextBatch.kind) || !Array.isArray(v.geometries) || typeof v.expiresAt !== 'string')
        throw new GiftApiError('invalid_session_response', 0);
    for (const c of v.compositions)
        if (c.state !== undefined && (!['not_started', 'preparing', 'stalled', 'failed', 'ready', 'approved'].includes(c.state) || !Number.isInteger(c.attempts) || c.attempts < 0 || typeof c.retryable !== 'boolean' || (c.preparingSince !== null && !Number.isFinite(Date.parse(c.preparingSince))) || (c.failureCode !== null && typeof c.failureCode !== 'string')))
            throw new GiftApiError('invalid_composition_state', 0);
    if (!['none', 'checkout_open', 'awaiting_artwork', 'approved', 'with_lab', 'refund_requested', 'refunded', 'cancelled', 'needs_attention'].includes(v.order.state))
        throw new GiftApiError('invalid_order_state', 0);
}
// Only the replacement masters/masks from litenco product image alphas 2-assets.zip.
const approvedSceneFamilies = { 'fine-art-portrait': 'fine_art', 'fine-art-landscape': 'fine_art', 'premium-square': 'premium', 'premium-landscape': 'premium', 'classic-framed-square': 'framed', 'classic-framed-portrait': 'framed', 'gallery-canvas-portrait': 'canvas', 'framed-canvas-portrait': 'framed_canvas', 'matted-frame-portrait': 'matted', 'fine-art-square': 'fine_art', 'premium-fine-art': 'premium', 'classic-framed': 'framed', 'matted-frame-square': 'matted', 'gallery-canvas-square': 'canvas', 'gallery-canvas-landscape': 'canvas', 'matted-frame-landscape': 'matted', 'framed-canvas': 'framed_canvas', 'ceramic-mug': 'mug', 'greeting-card': 'card' };
export function isApprovedScene(productId, sceneId) { return typeof sceneId === 'string' && (approvedSceneFamilies[sceneId] === productId.split(':')[0] || (productId.split(':')[0] === 'premium' && ['fine-art-square', 'fine-art-portrait'].includes(sceneId))); }
export const integrationBlocks = Object.freeze(['sandbox_final_release', 'mug_card_profiles']);
export class GiftBackend {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    async request(method, url, body, signal) {
        let response;
        try {
            response = await this.transport(url, { method, credentials: 'same-origin', cache: 'no-store', signal, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
        }
        catch (e) {
            if (signal?.aborted)
                throw e;
            throw new GiftApiError('network_failure', 0);
        }
        let value;
        try {
            value = await response.json();
        }
        catch {
            throw new GiftApiError('invalid_json_response', response.status);
        }
        if (!response.ok)
            throw new GiftApiError(record(value) && typeof value.error === 'string' ? value.error : 'gift_unavailable', response.status, value);
        return value;
    }
    async session(method, url, body, signal) { const result = await this.request(method, url, body, signal); assertSession(result); return result; }
    // Existing payload types are retained; no new endpoint or entitlement response is guessed.
    prePurchaseBatch(id, b) { return this.startBatch(id, b); }
    prePurchaseFavorite(id, b) { return this.selectArtwork(id, b); }
    create(image_b64, signal) { return this.session('POST', '/api/v1/gift/sessions', { image_b64 }, signal); }
    fromCollection(previewId) { return this.session('POST', '/api/v1/gift/sessions/from-collection', { previewId }); }
    async deleteDraft(id) { const r = await this.transport(sessionPath(id), { method: 'DELETE', credentials: 'same-origin', cache: 'no-store' }); if (r.status !== 204) {
        const v = await r.json().catch(() => null);
        throw new GiftApiError(v?.error || 'gift_delete_failed', r.status);
    } }
    restore(id, signal) { return this.session('GET', sessionPath(id), undefined, signal); }
    async restoreLatest(signal) {
        const v = await this.request('GET', '/api/v1/gift/sessions', undefined, signal);
        if (!v || v.contractVersion !== 1 || !Array.isArray(v.recent) || (v.current === null ? v.resume !== null : !v.resume))
            throw new GiftApiError('invalid_restore_response', 0);
        if (v.current) {
            assertSession(v.current);
            const r = v.resume;
            if (r.sessionId !== v.current.sessionId || !['effects', 'previews', 'products', 'cart', 'checkout', 'compositions', 'order'].includes(r.suggestedStep) || ![r.resumeBatches, r.runningBatches].every(a => Array.isArray(a) && a.every(n => Number.isInteger(n) && n > 0)))
                throw new GiftApiError('invalid_restore_response', 0);
        }
        const c = v.resume?.compositions;
        if (c != null && (!['not_started', 'preparing', 'stalled', 'failed', 'ready', 'approved'].includes(c.state) || typeof c.resumeNeeded !== 'boolean' || ![c.preparing, c.stalled, c.failed].every(a => Array.isArray(a) && a.every(x => typeof x === 'string'))))
            throw new GiftApiError('invalid_restore_response', 0);
        return v;
    }
    async catalog(signal) { const v = await this.request('GET', '/api/v1/print/catalog', undefined, signal); if (v.contractVersion !== 1 || !Array.isArray(v.products))
        throw new GiftApiError('invalid_catalog_response', 0); return v; }
    async availability(id, signal) { const v = await this.request('GET', sessionPath(id) + '/availability', undefined, signal); if (v.contractVersion !== 1 || v.sessionId !== id || !Array.isArray(v.products) || v.products.some(p => typeof p.purchasable !== 'boolean' || typeof p.productId !== 'string'))
        throw new GiftApiError('invalid_availability_response', 0); return v; }
    setLines(id, b, signal) { return this.session('PUT', sessionPath(id) + '/lines', { lines: b.lines.map(l => ({ lineId: l.lineId, productId: l.productId, copies: l.copies, ...(l.generationId ? { generationId: l.generationId } : {}), ...(l.frameColor ? { frameColor: l.frameColor } : {}), ...(l.acceptFinish === true ? { acceptFinish: true } : {}) })) }, signal); }
    async confirmOrder(b, signal) { const v = await this.request('POST', '/api/v1/gift/orders/confirm', { stripeSessionId: b.stripeSessionId }, signal); if (typeof v.confirmed !== 'boolean' || (v.confirmed && !v.session))
        throw new GiftApiError('invalid_confirmation_response', 0); if (v.session)
        assertSession(v.session); return v; }
    async batch(id, n, signal) { if (!Number.isInteger(n) || n < 1)
        throw new GiftApiError('invalid_batch_index', 0); return this.request('GET', sessionPath(id) + '/batches/' + n, undefined, signal); }
    selectArtwork(id, b, signal) { return this.session('POST', sessionPath(id) + '/artwork', { previewId: b.previewId }, signal); }
    async confirmPack(b, signal) { const v = await this.request('POST', '/api/v1/gift/preview-pack/confirm', { stripeSessionId: b.stripeSessionId }, signal); if (typeof v.confirmed !== 'boolean' || !Number.isInteger(v.paidPacksAvailable) || v.paidPacksAvailable < 0)
        throw new GiftApiError('invalid_pack_response', 0); return v; }
    refund(id, b, signal) { return this.request('POST', sessionPath(id) + '/refund-request', { reason: b.reason }, signal); }
    // Exact authoritative requests retained as types; held capabilities emit no request until CC/design reconciliation.
    async checkout(id, b) {
        if (b.disclosureAccepted !== true || !b.disclosureVersion)
            throw new GiftApiError('disclosure_required', 0);
        const v = await this.request('POST', sessionPath(id) + '/checkout', b);
        if (!v.publishableKey?.startsWith('pk_test_') || !v.stripeSessionId?.startsWith('cs_test_') || !v.clientSecret || !v.disclosure?.version || typeof v.disclosure.text !== 'string' || !v.totals || ![v.totals.itemsCents, v.totals.shippingCents, v.totals.totalCents].every(n => Number.isInteger(n) && n >= 0))
            throw new GiftApiError('test_checkout_required', 0);
        return v;
    }
    chooseEffect(id, effectId) { return this.session('POST', sessionPath(id) + '/effect', { effectId }); }
    async generateProduct(id, body) { const v = await this.request('POST', sessionPath(id) + '/generations', body); assertSession(v.session); return v; }
    async acceptGeneration(id, gid) { const v = await this.request('POST', sessionPath(id) + '/generations/' + segment(gid) + '/accept'); assertSession(v.session); return v; }
    startBatch(id, b) { return this.request('POST', sessionPath(id) + '/batches', { idempotencyKey: b.idempotencyKey, effectIds: b.effectIds }); }
    retryBatch(id, n) { if (!Number.isInteger(n) || n < 1)
        throw new GiftApiError('invalid_batch_index', 0); return this.request('POST', sessionPath(id) + '/batches/' + n + '/retry'); }
    async packCheckout(b) {
        const v = await this.request('POST', '/api/v1/gift/preview-pack/checkout', { returnPath: b.returnPath });
        if (!v.publishableKey?.startsWith('pk_test_') || !v.stripeSessionId?.startsWith('cs_test_') || v.amountCents !== 299 || !v.clientSecret)
            throw new GiftApiError('test_checkout_required', 0);
        return v;
    }
    async authenticated() { const v = await this.request('GET', '/api/v1/auth/me'); if (!v.user)
        throw new GiftApiError('authentication_required', 401); }
    async signIn(next) {
        if (!next.startsWith('/') || next.startsWith('//'))
            throw new GiftApiError('invalid_return_path', 0);
        const v = await this.request('POST', '/api/v1/auth/signin', { provider: 'google', next });
        if (!v.ok || !v.url || !/^https:\/\/[^/]+\.supabase\.co\/auth\/v1\/authorize\?/.test(v.url))
            throw new GiftApiError('invalid_signin_response', 0);
        const authorize = new URL(v.url);
        authorize.searchParams.set('prompt', 'select_account');
        return authorize.href;
    }
    compose(id) { return this.session('POST', sessionPath(id) + '/compositions'); }
    correct(id, lineId) { return this.session('POST', sessionPath(id) + '/compositions/' + segment(lineId) + '/correct'); }
    approveComposition(id, compositionId) { return this.session('POST', sessionPath(id) + '/compositions/' + segment(compositionId) + '/approve'); }
    finalize(id) { return this.session('POST', sessionPath(id) + '/finalize'); }
    approveOrder(id) { return this.finalize(id); }
    async mockup(id, lineId, compositionId, signal) {
        const v = await this.request('GET', sessionPath(id) + '/lines/' + segment(lineId) + '/mockup?compositionId=' + segment(compositionId), undefined, signal);
        if (!v || v.contractVersion !== 1 || v.sessionId !== id || v.lineId !== lineId || v.compositionId !== compositionId || typeof v.watermarked !== 'boolean' || v.productionPrintFile !== false || v.purchaseAuthorization !== false || !previewURL(v.url) || !(Date.parse(v.urlExpiresAt) > Date.now()) || !(v.width > 0 && v.height > 0) || !['frozen', 'legacy_catalog'].includes(v.geometrySource))
            throw new GiftApiError('invalid_mockup_response', 0);
        if (!isProductRepresentation(v, v.productId, v.scene?.sceneId))
            throw new GiftApiError('approved_scene_required', 0);
        return v;
    }
    async productPreview(id, productId, favoriteId, signal, generationId, frameColor) {
        const v = await this.request('GET', sessionPath(id) + '/product-preview?productId=' + encodeURIComponent(productId) + (generationId ? '&generationId=' + segment(generationId) : '&provisional=1') + (frameColor ? '&frameColor=' + encodeURIComponent(frameColor) : ''), undefined, signal);
        if (!v || v.contractVersion !== 1 || v.sessionId !== id || v.productId !== productId || v.favoriteId !== favoriteId || !['ready', 'provisional', 'adaptation_required', 'not_available'].includes(v.status))
            throw new GiftApiError('invalid_product_preview_response', 0);
        if ((v.status === 'ready' || v.status === 'provisional') && (v.watermarked !== true || v.productionPrintFile !== false || v.purchaseAuthorization !== false || !previewURL(v.url) || !(Date.parse(v.urlExpiresAt) > Date.now()) || !(v.width > 0 && v.height > 0) || !['scene', 'artwork', 'calibrated'].includes(v.renderer)))
            throw new GiftApiError('invalid_product_preview_response', 0);
        if ((v.status === 'ready' || v.status === 'provisional') && !isProductRepresentation(v.status === 'provisional' ? { ...v, ...v.provisional } : v, productId, v.sceneId))
            throw new GiftApiError('approved_scene_required', 0);
        if (v.status === 'ready' && frameColor && v.frameColor !== frameColor)
            throw new GiftApiError('invalid_product_preview_response', 0);
        if (v.status === 'ready' && v.beautyInput && (!previewURL(v.beautyInput.url) || v.beautyInput.generationId !== generationId || Date.parse(v.beautyInput.urlExpiresAt) <= Date.now() || !(v.beautyInput.width > 0 && v.beautyInput.height > 0)))
            throw new GiftApiError('invalid_product_preview_response', 0);
        if (generationId && !['ready', 'not_available'].includes(v.status))
            throw new GiftApiError('invalid_product_preview_response', 0);
        if (v.status === 'provisional') {
            const p = v.provisional;
            if (v.fit !== 'contain' || !p || p.exactArtworkShown !== true || p.cropped !== false || p.distorted !== false || p.surround !== 'neutral' || !p.bars || !['top_bottom', 'left_right'].includes(p.bars.sides) || !Number.isFinite(p.bars.fractionPerSide) || p.bars.fractionPerSide < 0 || p.bars.fractionPerSide >= 0.5 || !['generated', 'deterministic', null].includes(p.finalComposition))
                throw new GiftApiError('invalid_product_preview_response', 0);
        }
        return v;
    }
    block(reason) { return Promise.reject(new GiftApiError('integration_blocked', 0, { reason })); }
}
/** Carries the actual per-line server composition only; never falls back to the selected master. */
export function compositionReferences(session) {
    assertSession(session);
    if (!session.order.orderId || !session.artworkPreviewId || !['awaiting_artwork', 'approved', 'with_lab'].includes(session.order.state))
        return [];
    const lines = new Map(session.lines.map(l => [l.lineId, l]));
    const seen = new Set();
    return session.compositions.filter(c => {
        const line = lines.get(c.lineId);
        if (!line || line.productId !== c.productId || seen.has(c.lineId) || !c.compositionId || !c.previewUrl || !['ready', 'approved'].includes(c.status))
            return false;
        if (c.sourceArtworkId !== session.artworkPreviewId || !/^https:\/\//.test(c.previewUrl) || !c.width || !c.height)
            return false;
        seen.add(c.lineId);
        return true;
    }).map(c => ({ lineId: c.lineId, productId: c.productId, compositionId: c.compositionId, previewUrl: c.previewUrl, width: c.width, height: c.height, status: c.status, fit: c.fit }));
}
function isProductRepresentation(v, productId, sceneId) { return v.renderer === 'scene' ? isApprovedScene(productId, sceneId) : v.renderer === 'artwork' && v.representation === 'artwork_only' && v.physicalProductShown === false && v.previewBasis === 'product_shaped_artwork' && v.disclosureCode === 'artwork_only_preview' && typeof v.disclosure === 'string' && v.disclosure.trim().length > 0; }
