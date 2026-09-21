// Asset inspection only. The route gate is mandatory; this is not a customer Foyer.
export interface FoyerAssetManifest {
  category: string
  referenceSource: { path: string }
  imageSpec: { width: number; height: number; format: string }
  transformations: Array<{ id: string; path: string; caption: string | null }>
  fan: string[]
  mobileExtra: string[]
}

function between(source: string, start: string, end: string) {
  const a = source.indexOf(start)
  const b = source.indexOf(end, a + start.length)
  if (a < 0 || b < 0) throw new Error('Foyer reference seam changed')
  return source.slice(a, b)
}

export function buildAssetPreview(reference: string, manifest: FoyerAssetManifest) {
  const ids = Array.from({ length: 27 }, (_, i) => i + 1)
    .filter(i => i !== 18).map(i => `flip_${String(i).padStart(2, '0')}`)
  if (!['pets', 'groups', 'halloween'].includes(manifest.category) ||
      JSON.stringify(manifest.transformations.map(t => t.id)) !== JSON.stringify(ids) ||
      manifest.transformations.some(t => t.path !== `${t.id}.jpg`) ||
      manifest.referenceSource.path !== 'source.jpg' ||
      JSON.stringify(manifest.fan) !== JSON.stringify(['flip_23', 'flip_26', 'flip_24', 'flip_13', 'flip_06', 'flip_16']) ||
      JSON.stringify(manifest.mobileExtra) !== JSON.stringify(['flip_17', 'flip_11'])) {
    throw new Error('Foyer asset slots do not match the reference')
  }
  // These slices retain their source bytes. Only the image resolver is adapted.
  const shell = between(reference, '<!DOCTYPE html>', '<script src="foyer-DATA.js"></script>')
  let opening = between(reference, 'var IS_MOBILE=', '/* ── PRODUCTION: THE REAL REVEAL')
  const imageResolver = between(opening, 'function imgFor(id){', '/* The intake has answered.')
  opening = opening.replace(imageResolver, 'function imgFor(id){ return ASSET_ROOT + id + ".jpg"; }\n')
  const reveal = between(reference, '/* STATE 4: one result,', '/* PORTED VERBATIM from public/portraits.html:6414-6467')
  const data = JSON.stringify(manifest).replace(/</g, '\\u003c')
  return shell + `
<button type="button" id="assetReviewTools" style="position:fixed;top:0;right:0;z-index:1000">Asset review</button>
<dialog id="assetReview" open aria-labelledby="assetReviewTitle">
  <h2 id="assetReviewTitle">Foyer asset review</h2>
  <p>No upload, intake, crafting or customer handoff occurs on this page.</p>
  <p id="assetReviewStatus" role="status">Checking asset files…</p>
  <pre id="assetReviewErrors" role="alert"></pre>
  <label>Reveal asset <select id="assetReviewResult"><option value="">Choose a supplied slot</option></select></label>
  <p><button id="assetReviewStart" type="button" disabled>Inspect Foyer</button>
  <button id="assetReviewReload" type="button">Reload assets / restart</button></p>
</dialog>
<script>
'use strict';
var ASSET_MANIFEST = ${data};
var ASSET_ROOT = '/foyers/' + ASSET_MANIFEST.category + '/';
var reviewDialog = document.getElementById('assetReview');
var reviewStatus = document.getElementById('assetReviewStatus');
var reviewErrors = document.getElementById('assetReviewErrors');
var reviewStart = document.getElementById('assetReviewStart');
var reviewResult = document.getElementById('assetReviewResult');
var allAssetsReady = false, initialized = false;
document.title = ASSET_MANIFEST.category + ' — Foyer asset review';
reviewDialog.removeAttribute('open'); reviewDialog.showModal();
ASSET_MANIFEST.transformations.forEach(function(t){
  var option = document.createElement('option'); option.value = t.id; option.textContent = t.path;
  reviewResult.appendChild(option);
});
reviewResult.addEventListener('change', function(){ reviewStart.disabled = !allAssetsReady || !reviewResult.value; });
document.getElementById('assetReviewReload').addEventListener('click', function(){ location.reload(); });
document.getElementById('assetReviewTools').addEventListener('click', function(){ reviewDialog.showModal(); });
reviewDialog.addEventListener('cancel', function(e){ if (!initialized) e.preventDefault(); });
reviewStart.addEventListener('click', function(){
  if (!allAssetsReady || !reviewResult.value) return;
  reviewDialog.close();
  if (!initialized) { initialized = true; initializeReference(reviewResult.value); }
});
function inspectImage(path, isTransformation){
  return new Promise(function(resolve){
    var image = new Image(), settled = false;
    var timeout = setTimeout(function(){ finish(path + ': timed out'); }, 15000);
    function finish(error){
      if (settled) return; settled = true; clearTimeout(timeout);
      resolve(error || null);
    }
    image.onerror = function(){ finish(path + ': missing or unreadable'); };
    image.onload = function(){
      if (isTransformation && (image.naturalWidth !== ASSET_MANIFEST.imageSpec.width || image.naturalHeight !== ASSET_MANIFEST.imageSpec.height)) {
        finish(path + ': expected ' + ASSET_MANIFEST.imageSpec.width + '×' + ASSET_MANIFEST.imageSpec.height + ', found ' + image.naturalWidth + '×' + image.naturalHeight);
      } else if (image.decode) {
        image.decode().then(function(){ finish(); }, function(){ finish(path + ': cannot decode'); });
      } else finish();
    };
    image.src = ASSET_ROOT + path;
  });
}
Promise.all([inspectImage(ASSET_MANIFEST.referenceSource.path, false)].concat(
  ASSET_MANIFEST.transformations.map(function(t){ return inspectImage(t.path, true); })
)).then(function(results){
  var errors = results.filter(Boolean);
  allAssetsReady = errors.length === 0;
  reviewStatus.textContent = (27 - errors.length) + ' / 27 asset files ready. ' + (allAssetsReady ? 'Choose the reveal slot, then inspect the Foyer.' : 'Inspection is blocked until every reserved file is available.');
  reviewErrors.textContent = errors.join('\\n');
  reviewStart.disabled = !allAssetsReady || !reviewResult.value;
});
function initializeReference(resultId){
  var FLIPS = ASSET_MANIFEST.transformations.map(function(t){ return [t.id, t.caption || '']; });
  var IMG = function(id){ return ASSET_ROOT + id + '.jpg'; };
  // No allowance, intake verdict, user state or generated output is fabricated.
  var FOYER = { free: null, intake: null };
  function hideRevealStatus(){}
  function settle(){ throw new Error('Customer reveal state is not available in asset review'); }
${opening}
${reveal}
  function startAssetSequence(event){
    if (event) event.preventDefault();
    if (STATE.phase !== 'opening') return;
    begin(ASSET_ROOT + ASSET_MANIFEST.referenceSource.path);
    // One complete deck pass at the reference cadence, then the chosen supplied
    // plate enters the existing reveal seam. This is not a generation duration.
    later(function(){ generationReady({id:resultId, src:imgFor(resultId), label:''}); }, PHOTO_BEAT + FLIPS.length * RIFFLE_EVERY);
  }
  document.getElementById('file').addEventListener('click', startAssetSequence);
  document.getElementById('empty').addEventListener('click', startAssetSequence);
  ['btnUpload','btnCamera'].forEach(function(id){ var button = document.getElementById(id); if (button) button.addEventListener('click', startAssetSequence); });
  go.addEventListener('click', function(){ reviewDialog.showModal(); });
  window.addEventListener('pagehide', stopRiffle);
}
</script></body></html>`
}
