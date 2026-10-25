const wallArt = new Set(['fine_art', 'premium', 'framed', 'matted', 'canvas', 'framed_canvas']);
export function giftCompositionEligibility(product, option, subjectCount) {
    const w = option.imageWidthIn, h = option.imageHeightIn;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0)
        return { allowed: false, reason: 'invalid_catalog_geometry', aspect: null, pictureRatio: null, placement: 'picture' };
    const pictureRatio = w / h;
    // Generation aspect never changes the catalog's physical wrap or card geometry.
    if (product.id === 'mug')
        return { allowed: true, reason: null, aspect: 'catalog', pictureRatio, placement: 'picture' };
    if (product.id === 'card')
        return { allowed: true, reason: null, aspect: 'catalog', pictureRatio, placement: 'picture' };
    const matches = (ratio) => Math.abs(pictureRatio / ratio - 1) <= 0.02;
    const aspect = matches(1) ? '1:1' : matches(2 / 3) ? '2:3' : matches(3 / 2) ? '3:2' : null;
    const base = { aspect, pictureRatio, placement: 'picture' };
    if (!wallArt.has(product.id) || !aspect)
        return { ...base, allowed: false, reason: 'unsupported_artwork_ratio' };
    if (!Number.isInteger(subjectCount) || subjectCount < 1)
        return { ...base, allowed: false, reason: 'subject_count_required' };
    const allowed = aspect === '1:1' || (aspect === '2:3' && subjectCount <= 3) || (aspect === '3:2' && subjectCount >= 2);
    return { ...base, allowed, reason: allowed ? null : 'subject_count_restriction' };
}
// Returns existing options, without synthesizing SKUs or rewriting availability, price or finish.
export function giftCompositionOptions(product, options, subjectCount) {
    return options.map(option => ({ option, composition: giftCompositionEligibility(product, option, subjectCount) }));
}
