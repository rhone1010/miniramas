// Offline preparation uses the existing production composition pipeline. Never permits outpaint/generation calls.
require('tsx/cjs');
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const {compositionPlan}=require('../../lib/v1/print/geometry.ts');
const {preparePanelComposition}=require('../../lib/v1/print/asset-pipeline.ts');
const {mockupInputFor}=require('../../lib/v1/print/product-layout.visual.next.ts');
async function prepareSceneArtwork(sceneId,artwork){
 const m=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../public/gift-wizard/mockup-scenes',sceneId,'scene.next.json')));
 const b=m.maskBounds,panel=m.mapping?{w:1,h:1}:{w:b.x1-b.x0,h:b.y1-b.y0};
 const meta=await sharp(artwork).metadata();const plan=compositionPlan(meta.width,meta.height,panel.w,panel.h);
 if(plan.compatibility!=='recommended')throw Object.assign(Error(plan.compatibility==='extension'?'paid_extension_required':'product_regeneration_required'),{sceneId,source:[meta.width,meta.height],target:[panel.w,panel.h],extension:plan.extension});
 const prepared=await preparePanelComposition({imageB64:artwork.toString('base64'),panel});
 const bytes=m.mapping?await mockupInputFor('mug',prepared.working):prepared.working;
 return {bytes,method:prepared.fit,source:[meta.width,meta.height],prepared:[prepared.width,prepared.height],outpainted:prepared.outpainted,paidCalls:0};
}
module.exports={prepareSceneArtwork};
