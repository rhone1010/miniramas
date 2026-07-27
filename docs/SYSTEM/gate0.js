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
