import { GiftBackend } from '../gift-wizard/backend.next.js';
import { unavailableStudio, familyPhoto } from './studio.next.js';
const validId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const stateKey = (id) => 'liten_print_studio_view:' + id;
const quantity = (n) => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 20 ? Number(n) : 1;
export function collectionReturn(url, storage) {
    let previous = '';
    try {
        previous = storage.getItem('liten_collection_return') || '';
    }
    catch { }
    const from = url.searchParams.get('from');
    const series = from && ['portraits', 'groups', 'pets'].includes(from) ? from : { '/groups': 'groups', '/pets/discovery': 'pets', '/discovery': 'portraits' }[previous] || 'portraits';
    return '/collection?from=' + series;
}
export function restorePrintState(id, products, storage) {
    const state = { step: 'product', productId: products[0]?.id || '', size: '', copies: 1, drafts: {} };
    try {
        const raw = JSON.parse(storage.getItem(stateKey(id)) || 'null');
        if (!raw || typeof raw !== 'object')
            return state;
        for (const p of products) {
            const d = raw.drafts?.[p.id];
            if (d && p.options.some(o => o.size === d.size))
                state.drafts[p.id] = { size: d.size, copies: quantity(d.copies) };
        }
        const p = products.find(p => p.id === raw.productId);
        if (!p)
            return state;
        state.productId = p.id;
        state.copies = quantity(raw.copies);
        if (p.options.some(o => o.size === raw.size)) {
            state.size = raw.size;
            if (['product', 'size', 'options', 'review'].includes(raw.step))
                state.step = raw.step;
        }
    }
    catch { }
    return state;
}
export function persistPrintState(id, state, storage) {
    try {
        storage.setItem(stateKey(id), JSON.stringify({ step: state.step, productId: state.productId, size: state.size, copies: quantity(state.copies), drafts: Object.fromEntries(Object.entries(state.drafts).map(([family, d]) => [family, { size: d.size, copies: quantity(d.copies) }])) }));
    }
    catch { }
}
export async function loadPrintStudioData(id, transport = fetch) {
    if (!validId(id))
        throw Error('invalid_piece');
    async function read(path) { const r = await transport(path, { credentials: 'same-origin', cache: 'no-store' }); if (!r.ok)
        throw Error('print_unavailable'); return r.json(); }
    const source = await read('/api/v1/print/source?piece=' + encodeURIComponent(id));
    if (source?.piece?.id !== id || source.fulfilment !== true || ![source.piece.width, source.piece.height].every(n => Number.isInteger(n) && n > 0 && n <= 999999))
        throw Error('owned_artwork_required');
    const [catalog, photos] = await Promise.all([
        read('/api/v1/print/catalog?width=' + source.piece.width + '&height=' + source.piece.height),
        read('/gift-wizard/catalog.next.json')
    ]);
    if (catalog.contractVersion !== 1 || !Array.isArray(catalog.products) || catalog.artwork?.width !== source.piece.width || catalog.artwork?.height !== source.piece.height || !Array.isArray(photos.products))
        throw Error('invalid_catalog');
    const products = photos.products.map(p => {
        if (!/^\.\/(mockup-scenes|assets)\//.test(p.image) || p.image.includes('..'))
            throw Error('invalid_product_image');
        const options = catalog.products.filter(c => c.family === p.id && c.status === 'launch' && Number.isInteger(c.retailCents) && Number(c.retailCents) >= 0).map(c => {
            const r = c.requirements;
            if (!r || ![r.ppi, r.picturePx?.w, r.picturePx?.h].every(n => Number.isFinite(n) && n > 0))
                throw Error('invalid_product_geometry');
            return { size: c.size, label: c.label, retailCents: c.retailCents, attributes: c.attributes, compatible: c.selectable === true, imageWidthIn: r.picturePx.w / r.ppi, imageHeightIn: r.picturePx.h / r.ppi, sku: c.sku };
        });
        return { id: p.id, label: p.label, image: familyPhoto({ id: p.id, image: '/gift-wizard/' + p.image.slice(2) }), available: options.some(o => o.compatible), options };
    });
    return { pieceId: id, products };
}
const entrances = new Map();
export async function connectPrintStudio(host, url, storage, transport = fetch, onExit = () => location.assign(collectionReturn(url, storage)), onOpen = url => location.replace(url)) {
    if (url.searchParams.has('session'))
        return null;
    const id = url.searchParams.get('test_piece') || '';
    if (!validId(id))
        throw Error('invalid_piece');
    host.setAttribute('aria-busy', 'true');
    let request = entrances.get(id);
    if (!request) {
        request = new GiftBackend((url, init) => transport(url, init)).fromCollection(id).then(s => {
            if (s.entrance !== 'collection' || s.collection?.previewId !== id)
                throw Error('owned_artwork_required');
            return '/gift-wizard.next.html?sessionId=' + encodeURIComponent(s.sessionId);
        });
        entrances.set(id, request);
    }
    try {
        const destination = await request;
        onOpen(destination);
        return destination;
    }
    finally {
        entrances.delete(id);
        host.removeAttribute('aria-busy');
    }
}
if (typeof document !== 'undefined') {
    const host = document.getElementById('screen');
    if (host) {
        let storage;
        try {
            storage = sessionStorage;
        }
        catch {
            storage = { getItem: () => null, setItem: () => { } };
        }
        connectPrintStudio(host, new URL(location.href), storage).catch(() => { unavailableStudio(host, () => location.assign(collectionReturn(new URL(location.href), storage))); });
    }
}
