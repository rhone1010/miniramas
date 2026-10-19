/** Isolated visualization adapter. No payment, entitlement, approval, or fulfillment state. */
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {composeProductMockup,loadTemplate}=require('./compositor.next.cjs');
const {composeFrameFinish}=require('./frame-finish.next.cjs');
const {composeDerivedFrame}=require('./derived-frame.next.cjs');
const registry=Object.freeze({
 'matted-frame':Object.freeze({productId:'matted',mapping:'perspective-mat',derived:true}),
 'matted-frame-square':Object.freeze({productId:'matted',mapping:'perspective-mat',derived:true}),
 'framed-canvas':Object.freeze({productId:'framed_canvas',mapping:'perspective-float',derived:true}),
 'framed-canvas-square':Object.freeze({productId:'framed_canvas',mapping:'perspective-float',derived:true}),
 'fine-art':Object.freeze({productId:'fine_art',mapping:'perspective'}),
 'premium-fine-art':Object.freeze({productId:'premium',mapping:'perspective'}),
 'classic-framed':Object.freeze({productId:'framed',mapping:'perspective',shape:'rectangular',frame:true}),
 'gallery-canvas':Object.freeze({productId:'canvas',mapping:'MirrorWrap',shape:'rectangular'}),
 'square-framed':Object.freeze({productId:'framed',mapping:'perspective',shape:'square',frame:true}),
 'gallery-canvas-square':Object.freeze({productId:'canvas',mapping:'MirrorWrap',shape:'square'}),
 'ceramic-mug':Object.freeze({productId:'mug',mapping:'cylindrical',testOnly:true}),
 'greeting-card':Object.freeze({productId:'card',mapping:'perspective-front',testOnly:true})
});
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
async function catalog(){return JSON.parse(await fs.readFile(path.resolve(__dirname,'../../public/gift-wizard/catalog.next.json'),'utf8'))}
function resolveCatalogTemplate(line,products){
 const product=products.find(p=>p.id===line.productId),option=product?.options.find(o=>o.size===line.size);
 if(!product?.available||!option)throw Error('unavailable_catalog_configuration');
 if(!Number.isFinite(option.imageWidthIn)||!Number.isFinite(option.imageHeightIn)||option.imageWidthIn<=0||option.imageHeightIn<=0)throw Error('missing_catalog_geometry');
 if(line.attributes&&JSON.stringify(Object.entries(line.attributes).sort())!==JSON.stringify(Object.entries(option.attributes||{}).sort()))throw Error('unverified_catalog_attributes');
 const square=option.imageWidthIn===option.imageHeightIn;
 const templateId={fine_art:'fine-art',premium:'premium-fine-art',framed:square?'square-framed':'classic-framed',canvas:square?'gallery-canvas-square':'gallery-canvas'}[product.id];
 if(!templateId)throw Error('unsupported_catalog_product');
 if(product.id==='canvas'&&option.attributes?.wrap!=='MirrorWrap')throw Error('unverified_canvas_wrap');
 if(product.id==='framed'&&option.attributes?.color!=='black')throw Error('unverified_frame_finish');
 return {templateId,productId:product.id,sku:option.sku,attributes:{...option.attributes},targetGeometry:{widthIn:option.imageWidthIn,heightIn:option.imageHeightIn},requiredPx:{...option.requiredPx}};
}
async function renderResolved({templateId,artwork,artworkId,allowCrop=false,targetGeometry,wrapGeometry,finish,outputPath,configuration}){
 if(!registry[templateId]||!artworkId)throw Error('missing_visualization_identity');
 const data=Buffer.isBuffer(artwork)?artwork:await fs.readFile(artwork);
 const {directory,manifest}=await loadTemplate(templateId);
 // Includes calibration and current asset bytes, so a revised template cannot reuse a stale visualization key.
 const assets={};for(const file of [...new Set([manifest.sourceImage,manifest.artworkMask,manifest.backgroundMask,manifest.frameMask,manifest.frameFinishMask,...(manifest.sides||[]).map(s=>s.mask)].filter(Boolean))])assets[file]=hash(await fs.readFile(path.join(directory,file)));
 const request={templateId,productId:registry[templateId].productId,artwork:data,fit:'cover',allowCrop,targetGeometry,wrapGeometry,wrap:'MirrorWrap',outputPath};
 const result=registry[templateId].frame?await composeFrameFinish({...request,finish:finish||'black'}):await composeProductMockup(request);
 const identity={renderer:hash(await fs.readFile(path.join(__dirname,'compositor.next.cjs'))),finishRenderer:registry[templateId].frame?hash(await fs.readFile(path.join(__dirname,'frame-finish.next.cjs'))):null,finishReference:result.metadata.finishReference||null,templateId,template:hash(JSON.stringify({manifest,assets})),artworkId,artworkHash:hash(data),targetGeometry,wrapGeometry,finish:finish||null,configuration,fit:'cover',allowCrop};
 return {...result,visualizationKey:hash(JSON.stringify(identity)),identity,productionPrintFile:false,purchaseAuthorization:false};
}
async function composeCatalogItem({line,artwork,artworkId,allowCrop=false,outputPath}){
 const resolved=resolveCatalogTemplate(line,(await catalog()).products);
 return renderResolved({...resolved,artwork,artworkId,allowCrop,outputPath,finish:resolved.attributes.color,configuration:{sku:resolved.sku,attributes:resolved.attributes,requiredPx:resolved.requiredPx}});
}
// Offline fixture tests only. Deliberately separate from catalog resolution; never used as availability authorization.
async function composeTemplateVisualTest({templateId,artwork,artworkId,targetGeometry,allowCrop=false,finish,outputPath,size,floatGapIn}){
 const r=registry[templateId];if(!r)throw Error('unknown_template');
 if(r.derived)return composeDerivedFrame({templateId,artwork,artworkId,size,floatGapIn,outputPath});
 if(finish&&!r.frame)throw Error('finish_requires_frame');
 if(r.shape==='square'&&(!targetGeometry||targetGeometry.widthIn!==targetGeometry.heightIn))throw Error('square_geometry_required');
 if(r.shape==='rectangular'&&(!targetGeometry||targetGeometry.widthIn===targetGeometry.heightIn))throw Error('rectangular_geometry_required');
 return renderResolved({templateId,artwork,artworkId,targetGeometry:templateId==='ceramic-mug'?undefined:targetGeometry,wrapGeometry:templateId==='ceramic-mug'?{widthPx:2670,heightPx:1110}:undefined,allowCrop,finish,outputPath,configuration:{offlineVisualTest:true}});
}
module.exports={registry,resolveCatalogTemplate,composeCatalogItem,composeTemplateVisualTest};

