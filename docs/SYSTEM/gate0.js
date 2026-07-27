const src = require('fs').readFileSync('portraits-catalogue.js','utf8');
const F = new Function(src + `
 return {CATALOGUE,EFFECTS_FLAT,COLLECTION_FILTERS,CREDITS_PER_IMAGE,CREDIT_BLOCKS,
 creditsFor,usdFor,tierFor,pieceId,effectLabel,effectArt,PASS_SINGLE};`);
const M = F();
const ids = M.EFFECTS_FLAT.map(e=>e.id);
const dup = ids.filter((x,i)=>ids.indexOf(x)!==i);
const fail = m => { throw new Error('GATE FAIL — '+m); };
if (M.CATALOGUE.length !== 6) fail('silo count');
if (M.EFFECTS_FLAT.length !== 36) fail('effect count');
if (dup.length) fail('duplicate ids: '+dup);
if (ids.includes('deep_sea')) fail('deep_sea present — it is cut');
if (ids.includes('fantasy_crystal')) fail('fantasy_crystal — renamed enchanted_crystal');
if (M.COLLECTION_FILTERS.length !== 6) fail('filter count');
if (M.COLLECTION_FILTERS.some(f=>['houses','landscapes'].includes(f.id))) fail('stale series in filter');
if (M.CREDITS_PER_IMAGE !== 10) fail('credits per image');
if (M.usdFor(10) !== 34.93) fail('studio price');
if (M.tierFor(10) !== 'THE STUDIO') fail('studio tier');
if (M.pieceId('Portraits','walnut',247) !== 'Portraits-Walnut-0247') fail('piece id format');
if (M.PASS_SINGLE !== 8) fail('likeness threshold');
console.log('silos 6 · effects 36 · no dups · filters 6 · 10 credits/image');
[1,2,3,4,5,10].forEach(n=>console.log(' ',n+' img →',M.creditsFor(n)+' cr · $'+M.usdFor(n)+' · '+M.tierFor(n)));
console.log('  pieceId →', M.pieceId('Portraits','walnut',247));
console.log('  awaiting engine prompts:', M.EFFECTS_FLAT.filter(e=>!e.engine).map(e=>e.id).join(', '));
console.log('ALL GATES PASS');

// ── build 0b: engine reconciliation gates ──────────────────────────────────
const src2 = require('fs').readFileSync('portraits-catalogue.js','utf8');
const M2 = new Function(src2 + ' return {EFFECTS_FLAT};')();
const ENGINE = ['plushy','bronze','iron','alabaster','stone','ebony','walnut','impressionist',
 'torn_paper','folded_book','charcoal_chalk','pencil_sketch','sheet_music','pewter',
 'chocolate','stained_glass','driftwood_resin'];
const CURATOR = ['bronze','alabaster','stone','ebony','walnut','iron','impressionist',
 'torn_paper','folded_book','charcoal_chalk','pencil_sketch','sheet_music'];
const flagged = M2.EFFECTS_FLAT.filter(e=>e.engine).map(e=>e.id).sort();
const truth   = M2.EFFECTS_FLAT.filter(e=>ENGINE.includes(e.id)).map(e=>e.id).sort();
if (JSON.stringify(flagged)!==JSON.stringify(truth))
  throw new Error('GATE FAIL — engine flags disagree with PRESET_LABELS');
console.log('engine-backed:', truth.length + '/36');
console.log('curator-visible:', M2.EFFECTS_FLAT.filter(e=>e.curator).length + '/36');
console.log('  in engine, invisible to Curator:',
  ENGINE.filter(id=>!CURATOR.includes(id)).join(', '));
console.log('  no engine prompt at all:',
  M2.EFFECTS_FLAT.filter(e=>!e.engine).length);
console.log('RECONCILIATION GATES PASS');
