// Server-side scene placement only. No entitlement, composition generation, approval or production-file authority.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {replaceScene}=require('../catalog-samples/scene-replacement-review.next.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const root=()=>process.env.GIFT_MOCKUP_TOOLS_DIR||path.resolve(__dirname,'../..');
function describeScene(sceneId){
 if(typeof sceneId!=='string'||!/^[a-z0-9-]+$/.test(sceneId))throw Error('bad_scene_id');
 const base=root(),inventory=JSON.parse(fs.readFileSync(path.join(base,'public/gift-wizard/mockup-scenes/inventory.next.json')));
 if(!inventory.scenes.some(s=>s.id===sceneId))throw Error('unknown_scene');
 const m=JSON.parse(fs.readFileSync(path.join(base,'public/gift-wizard/mockup-scenes',sceneId,'scene.next.json'))),b=m.maskBounds;
 return {sceneId,family:m.family,width:m.dimensions[0],height:m.dimensions[1],inputAspect:m.mapping?2670/1110:(b.x1-b.x0)/(b.y1-b.y0),inputKind:m.mapping?'rolled-full-wrap':'scene-composition',productionGeometry:false};
}
function revision(sceneId){
 describeScene(sceneId);
 const files=['tools/product-scenes/adapter.next.cjs','tools/catalog-samples/scene-replacement-review.next.cjs','tools/product-mockup/compositor.next.cjs','public/gift-wizard/mockup-scenes/inventory.next.json'];
 const dir='public/gift-wizard/mockup-scenes/'+sceneId;
 for(const f of fs.readdirSync(path.join(root(),dir)).sort())files.push(dir+'/'+f);
 return sha(files.map(f=>f+':'+sha(fs.readFileSync(path.join(root(),f)))).join('|'));
}
async function renderScene({sceneId,productFamily,artworkId,artwork}){
 const d=describeScene(sceneId);
 if(d.family!==productFamily)throw Error('scene_family_mismatch');
 if(typeof artworkId!=='string'||!artworkId||!Buffer.isBuffer(artwork))throw Error('invalid_scene_input');
 const templateRevision=revision(sceneId);
 const r=await replaceScene({sceneId,artwork,assetRoot:root()});
 return {png:r.png,width:d.width,height:d.height,templateRevision,visualizationKey:sha(JSON.stringify({sceneId,productFamily,artworkId,artworkSha256:sha(artwork),templateRevision})),metadata:r.metadata};
}
module.exports={describeScene,revision,renderScene};
