const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto'),sharp=require('sharp');
const {test}=require('node:test');const a=require('./adapter.next.cjs');
const inventory=JSON.parse(fs.readFileSync('public/gift-wizard/mockup-scenes/inventory.next.json'));
test('all ten scenes use exact approved replacement with stable content identity',async()=>{
 const {replaceScene}=require('../catalog-samples/scene-replacement-review.next.cjs');
 for(const s of inventory.scenes){const d=a.describeScene(s.id),height=555,width=Math.round(height*d.inputAspect);const artwork=await sharp({create:{width,height,channels:3,background:'#456abc'}}).png().toBuffer();
 const r=await a.renderScene({sceneId:s.id,productFamily:s.family,artworkId:'fixture-current-composition',artwork});
 const baseline=await replaceScene({sceneId:s.id,artwork});assert.ok(r.png.equals(baseline.png));assert.equal(r.width,1254);assert.equal(r.height,1254);assert.equal(r.templateRevision,a.revision(s.id));assert.equal(r.metadata.productionPrintFile,false);
 const changed=await a.renderScene({sceneId:s.id,productFamily:s.family,artworkId:'fixture-corrected-composition',artwork});assert.notEqual(r.visualizationKey,changed.visualizationKey);
 }
});
test('unknown scenes, family mismatches and incompatible production artwork fail closed',async()=>{
 assert.throws(()=>a.describeScene('../fine-art'),/bad_scene_id/);assert.throws(()=>a.describeScene('not-a-scene'),/unknown_scene/);
 const artwork=await sharp({create:{width:600,height:900,channels:3,background:'red'}}).png().toBuffer();
 await assert.rejects(a.renderScene({sceneId:'gallery-canvas-square',productFamily:'framed',artworkId:'a',artwork}),/scene_family_mismatch/);
 await assert.rejects(a.renderScene({sceneId:'gallery-canvas-square',productFamily:'canvas',artworkId:'a',artwork}),/scene_composition_required/);
});
test('serverless trace (next.config.js) contains every hashed scene runtime dependency',()=>{
 const manifest=JSON.parse(fs.readFileSync('tools/product-scenes/bundle.next.json'));const cfg=require('../../next.config.js');const tracing=cfg.outputFileTracingIncludes['/api/v1/gift/sessions/[id]/lines/[lineId]/mockup'];
 for(const f of manifest.files){const b=fs.readFileSync(f.path);assert.equal(b.length,f.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),f.sha256);assert.ok(tracing.includes('./'+f.path),f.path);}
 assert.ok(!manifest.files.some(f=>/test|fixture|contact-sheet/.test(f.path)));
 assert.equal(require('../../next.config.js').outputFileTracingIncludes['/api/v1/gift/sessions/[id]/lines/[lineId]/mockup'].some(p=>p.includes('mockup-scenes')),true);
});
