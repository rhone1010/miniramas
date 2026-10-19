// Derived product surfaces. Original calibrated frame renderer and photographs are unchanged.
const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp'),crypto=require('node:crypto');
const {composeFrameFinish}=require('./frame-finish.next.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const mats={'8x8':[6,6],'12x12':[9,9],'16x16':[12,12],'20x20':[16,16],'8x12':[6,10],'12x18':[8.06,14.06],'16x24':[12.06,20.06],'20x30':[16,26]};
async function composeDerivedFrame({templateId,artwork,artworkId,size,floatGapIn,outputPath}){
 const dir=path.resolve(__dirname,'../../public/gift-wizard/mockup-templates'),manifest=JSON.parse(await fs.readFile(path.join(dir,templateId,'template.next.json'),'utf8'));
 const matted=manifest.productId==='matted';if(!mats[size]||(!matted&&size==='8x12'))throw Error('unsupported_or_held_size');
 const [fw,fh]=size.split('x').map(Number),square=fw===fh;if(templateId.endsWith('-square')!==square)throw Error('template_shape_mismatch');
 if(!matted&&!(Number.isFinite(floatGapIn)&&floatGapIn>0))throw Error('float_gap_unverified');
 if(!matted)throw Error('float_side_plane_calibration_required');
 const [pw,ph]=matted?mats[size]:[fw,fh],data=Buffer.isBuffer(artwork)?artwork:await fs.readFile(artwork),meta=await sharp(data).metadata();
 if(Math.abs(meta.width/meta.height/(pw/ph)-1)>.003)throw Error('artwork_geometry_mismatch');
 const scale=100,depth=matted?0:38/25.4,gap=matted?0:floatGapIn;
 const W=Math.round((fw+gap*2+depth)*scale),H=Math.round((fh+gap*2+depth)*scale),aw=Math.round(pw*scale),ah=Math.round(ph*scale);
 const x=matted?Math.round((W-aw)/2):Math.round(gap*scale),y=matted?Math.round((H-ah)/2):Math.round(gap*scale);
 const art=await sharp(data).resize(aw,ah,{fit:'fill'}).png().toBuffer();let layers=[];
 if(!matted){const edge=await sharp(art).extract({left:0,top:Math.max(0,ah-Math.round(depth*scale)),width:aw,height:Math.round(depth*scale)}).flip().modulate({brightness:.55}).png().toBuffer();layers.push({input:edge,left:x,top:y+ah});const side=await sharp(art).extract({left:aw-Math.round(depth*scale),top:0,width:Math.round(depth*scale),height:ah}).flop().modulate({brightness:.65}).png().toBuffer();layers.push({input:side,left:x+aw,top:y});}
 if(matted){const bevel=2.4/25.4*scale;const svg='<svg width="'+W+'" height="'+H+'"><defs><filter id="mount"><feGaussianBlur stdDeviation="'+(bevel/3)+'"/></filter></defs><rect x="'+x+'" y="'+y+'" width="'+aw+'" height="'+ah+'" fill="#777" filter="url(#mount)"/></svg>';layers.push({input:Buffer.from(svg),left:0,top:0});}
 layers.push({input:art,left:x,top:y});
 const panel=await sharp({create:{width:W,height:H,channels:3,background:matted?'#ffffff':'#191919'}}).composite(layers).png().toBuffer();
 const result=await composeFrameFinish({templateId:manifest.baseTemplate,productId:'framed',artwork:panel,targetGeometry:{widthIn:W,heightIn:H},fit:'cover',allowCrop:false,finish:'black'});
 const base=path.join(dir,manifest.baseTemplate),assets=[];for(const f of (await fs.readdir(base)).sort())assets.push(hash(await fs.readFile(path.join(base,f))));
 const identity={templateId,artworkId,artworkHash:hash(data),size,floatGapIn:gap,manifest,assets,layerRenderer:hash(await fs.readFile(__filename))};
 if(outputPath)await fs.writeFile(outputPath,result.png);
 return {...result,metadata:{...result.metadata,templateId,productId:manifest.productId,sourceArtwork:{width:meta.width,height:meta.height},pictureIn:{w:pw,h:ph},frameIn:{w:fw,h:fh},provisional:true,safetyMargin:manifest.safetyMargin,floatGapIn:gap,canvasDepthMm:matted?null:38,artworkCrop:false},visualizationKey:hash(JSON.stringify(identity)),identity,productionPrintFile:false,purchaseAuthorization:false};
}
module.exports={composeDerivedFrame};
