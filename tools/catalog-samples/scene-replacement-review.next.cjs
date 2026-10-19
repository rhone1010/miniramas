// Clean masked replacement. Original selected artwork is never used as a lighting multiplier.
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const {homography,project,cylindricalUV}=require('../product-mockup/compositor.next.cjs');
async function replaceScene({sceneId,artwork}){
 const root=path.resolve('public/gift-wizard/mockup-scenes',sceneId),m=JSON.parse(fs.readFileSync(path.join(root,'scene.next.json')));
 if(m.status.startsWith('blocked'))throw Error(m.status);
 const base=await sharp(path.join(root,m.sourceImage)).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const mask=await sharp(path.join(root,m.artworkMask)).flatten({background:'black'}).greyscale().raw().toBuffer();
 const a=await sharp(artwork).flatten({background:'white'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const inverse=homography(m.cornersPixels,[[0,0],[1,0],[1,1],[0,1]]),b=m.maskBounds;
 const ratio=m.mapping?2670/1110:(b.x1-b.x0)/(b.y1-b.y0),ar=a.info.width/a.info.height;
 if(m.mapping&&Math.abs(ar/ratio-1)>.003)throw Error('mug_full_wrap_required');
 if(Math.abs(ar/ratio-1)>1e-6)throw Object.assign(Error('scene_composition_required'),{sceneId,sourceAspect:ar,targetAspect:ratio});
 const output=Buffer.from(base.data);
 function sample(ax,ay,c){const sx=ax*(a.info.width-1),sy=ay*(a.info.height-1),x=Math.floor(sx),y=Math.floor(sy),xx=Math.min(x+1,a.info.width-1),yy=Math.min(y+1,a.info.height-1),tx=sx-x,ty=sy-y;return (a.data[(y*a.info.width+x)*3+c]*(1-tx)+a.data[(y*a.info.width+xx)*3+c]*tx)*(1-ty)+(a.data[(yy*a.info.width+x)*3+c]*(1-tx)+a.data[(yy*a.info.width+xx)*3+c]*tx)*ty;}
 for(let y=0;y<1254;y++)for(let x=0;x<1254;x++){
  const i=y*1254+x,k=mask[i]/255;if(!k)continue;
  let [u,v]=project(inverse,x,y);if(m.mapping)[u,v]=cylindricalUV(m.mapping,u,v,0);
  // Clamp only mask antialias fringe outside the calibrated plane; never synthesize a white band.
  const ax=Math.max(0,Math.min(1,u)),ay=Math.max(0,Math.min(1,v));
  for(let c=0;c<3;c++)output[i*3+c]=Math.round(base.data[i*3+c]*(1-k)+sample(ax,ay,c)*k);
 }
 return {png:await sharp(output,{raw:{width:1254,height:1254,channels:3}}).png().toBuffer(),raw:output,base:base.data,mask,metadata:{reviewOnly:true,croppedPixels:0,fit:m.mapping?'cylindrical-full-wrap':'exact-composition',originalArtworkMultiplied:false,productionPrintFile:false,family:m.family}};
}
module.exports={replaceScene};
