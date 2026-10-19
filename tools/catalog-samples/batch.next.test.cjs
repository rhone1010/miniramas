const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const {validate,prepareArtwork}=require('./batch.next.cjs');const m=JSON.parse(fs.readFileSync('tools/catalog-samples/manifest.next.json'));
test('24 assignments retain exact source and authoritative prompt hashes',()=>validate(m));
test('duplicate product assignments fail closed',()=>{const bad=structuredClone(m);bad.rows[1].family=bad.rows[0].family;assert.throws(()=>validate(bad),/eight unique/);});
test('changed artwork is rejected',()=>{const bad=structuredClone(m);bad.rows[0].artwork.sha256='wrong';assert.throws(()=>validate(bad),/Artwork changed/);});
test('source ratio requiring crop or extension is rejected',async()=>assert.rejects(prepareArtwork(m.rows[0].artwork.path,[1,1]),/crop forbidden/));
test('bounded 2:3 rounding retains the complete artwork',async()=>{const r=await prepareArtwork(m.rows[0].artwork.path,[2,3]);assert.equal(r.adjustment.croppedPixels,0);assert.ok(r.adjustment.relativeAspectChange<.02);});
test('paid execution cannot be enabled in this offline tool',()=>{const bad=structuredClone(m);bad.paidExecutionAuthorized=true;assert.throws(()=>validate(bad),/never executes paid/);});
