const fs=require('fs'),path=require('path'),sharp=require('sharp');
const {prepareSceneArtwork}=require('./scene-composition.next.cjs');const {replaceScene}=require('./scene-replacement-review.next.cjs');
const mapping={fine_art:'fine-art-square',premium:'premium-fine-art',framed:'classic-framed',matted:'matted-frame-square',canvas:'gallery-canvas-square',framed_canvas:'framed-canvas',mug:'ceramic-mug',card:'greeting-card'};
async function run(out){fs.mkdirSync(out,{recursive:true});const manifest=JSON.parse(fs.readFileSync('tools/catalog-samples/manifest.next.json'));const index=JSON.parse(fs.readFileSync('public/gift-wizard/catalog-samples/index.next.json'));const results=[];
for(const row of manifest.rows){const sceneId=mapping[row.family];const m=JSON.parse(fs.readFileSync(`public/gift-wizard/mockup-scenes/${sceneId}/scene.next.json`));let png,status='rendered',reason=null,preparation=null;
try{if(!row.artwork)throw Error('assigned_artwork_missing');preparation=await prepareSceneArtwork(sceneId,fs.readFileSync(row.artwork.path));png=(await replaceScene({sceneId,artwork:preparation.bytes})).png;}catch(e){if(!['assigned_artwork_missing','paid_extension_required','product_regeneration_required'].includes(e.message))throw e;status='placeholder';reason=e.message;png=fs.readFileSync(`public/gift-wizard/mockup-scenes/${sceneId}/${m.sourceImage}`);}
for(const [tag,width]of [['desktop',720],['mobile',360]]){const name=`${row.id}-scene-${tag}.webp`;await sharp(png).resize(width).webp({quality:85}).toFile(`public/gift-wizard/catalog-samples/${name}`);index.series[row.series][row.family][tag]='/gift-wizard/catalog-samples/'+name;}
Object.assign(index.series[row.series][row.family],{placeholder:status==='placeholder',templateId:sceneId,status,reason});results.push({id:row.id,sceneId,status,reason,preparation:preparation?{...preparation,bytes:undefined}:null});
}
fs.writeFileSync('public/gift-wizard/catalog-samples/index.next.json',JSON.stringify(index,null,2)+'\n');fs.writeFileSync(path.join(out,'catalog-results.json'),JSON.stringify({paidCalls:0,results},null,2));console.log(JSON.stringify(results.map(r=>({id:r.id,status:r.status,reason:r.reason}))));
}
if(require.main===module)run(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1});module.exports={mapping};
