/** Authenticated state boundary. A URL selects a project; it never proves payment. */
import { GiftApiError, assertSession } from './backend.next.js';
export function purchased(s) { return !!s.order.orderId && ['awaiting_artwork', 'approved', 'with_lab'].includes(s.order.state); }
export function canCraft(s) { return ['none', 'checkout_open', 'awaiting_artwork'].includes(s.order.state) && Date.parse(s.expiresAt) > Date.now() && ((s.nextBatch.kind === 'free' && s.entitlement.freeAvailable) || (s.nextBatch.kind === 'paid' && s.entitlement.paidPacksAvailable > 0)); }
export class LiveGift {
    api;
    id;
    value = null;
    epoch = 0;
    unavailableScenes = new Set();
    mockups = new Map();
    compositionIssues = new Map();
    constructor(api, id) {
        this.api = api;
        this.id = id;
    }
    clear() { this.epoch++; this.value = null; this.mockups.clear(); this.unavailableScenes.clear(); this.compositionIssues.clear(); }
    get session() { return this.value ? structuredClone(this.value) : null; }
    accept(s) { assertSession(s); if (s.sessionId !== this.id)
        throw new GiftApiError('session_identity_mismatch', 0); this.epoch++; this.value = structuredClone(s); this.mockups.clear(); this.unavailableScenes.clear(); for (const [lineId, issue] of this.compositionIssues) {
        if (issue.sourceArtworkId !== s.artworkPreviewId || !s.lines.some(l => l.lineId === lineId && l.productId === issue.productId))
            this.compositionIssues.delete(lineId);
    } }
    async restore(signal) { const n = ++this.epoch; this.value = null; this.mockups.clear(); this.unavailableScenes.clear(); const s = await this.api.restore(this.id, signal); if (n === this.epoch)
        this.accept(s); }
    async mockup(lineId, signal) {
        const s = this.session, n = this.epoch;
        if (!s || !purchased(s))
            throw new GiftApiError('order_payment_required', 0);
        const line = s.lines.find(l => l.lineId === lineId), c = s.compositions.find(c => c.lineId === lineId && c.productId === line?.productId && c.sourceArtworkId === s.artworkPreviewId && c.compositionId && ['ready', 'approved'].includes(c.status));
        if (!line || !c?.compositionId)
            throw new GiftApiError('composition_not_found', 0);
        let m;
        try {
            m = await this.api.mockup(this.id, lineId, c.compositionId, signal);
        }
        catch (e) {
            if (n === this.epoch && this.value?.compositions.some(x => x.lineId === lineId && x.compositionId === c.compositionId)) {
                this.mockups.delete(lineId);
                if (e instanceof GiftApiError && e.code === 'approved_scene_required')
                    this.unavailableScenes.add(lineId);
                if (e instanceof GiftApiError && e.status === 409 && e.code === 'composition_geometry_mismatch')
                    this.compositionIssues.set(lineId, { code: e.code, sourceArtworkId: c.sourceArtworkId, productId: line.productId });
            }
            throw e;
        }
        const current = this.value?.compositions.find(x => x.lineId === lineId);
        if (n !== this.epoch || current?.compositionId !== m.compositionId || this.value?.artworkPreviewId !== m.sourceArtworkId || m.productId !== line.productId || m.attempt !== c.attempt || m.sku !== c.sku)
            throw new GiftApiError('stale_composition', 409);
        this.compositionIssues.delete(lineId);
        this.unavailableScenes.delete(lineId);
        this.mockups.set(lineId, m);
        return m;
    }
}
