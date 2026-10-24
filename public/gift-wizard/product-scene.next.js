import {tintFramePixels} from './frame-finishes.next.js';
import {MUG,mugPanelRects} from './backend-contracts/print/production-profiles.js';
// Projection functions copied unchanged from tools/product-mockup/compositor.next.cjs, lines 7–34 and 178–183.
function solve(matrix, rhs) {
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < rhs.length; col++) {
    let pivot = col;
    for (let i = col + 1; i < rhs.length; i++) if (Math.abs(a[i][col]) > Math.abs(a[pivot][col])) pivot = i;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    if (Math.abs(a[col][col]) < 1e-12) throw Error('Degenerate printable surface');
    const divisor = a[col][col];
    for (let j = col; j <= rhs.length; j++) a[col][j] /= divisor;
    for (let i = 0; i < rhs.length; i++) if (i !== col) {
      const factor = a[i][col];
      for (let j = col; j <= rhs.length; j++) a[i][j] -= factor * a[col][j];
    }
  }
  return a.map(row => row[rhs.length]);
}
function homography(from, to) {
  const a = [], b = [];
  from.forEach(([x,y],i) => {
    const [u,v] = to[i];
    a.push([x,y,1,0,0,0,-u*x,-u*y], [0,0,0,x,y,1,-v*x,-v*y]); b.push(u,v);
  });
  return [...solve(a,b),1];
}
function project(h,x,y) {
  const d=h[6]*x+h[7]*y+h[8];
  return [(h[0]*x+h[1]*y+h[2])/d,(h[3]*x+h[4]*y+h[5])/d];
}
function cylindricalUV(mapping,x,y,rotationTurns=0){
 const t=Math.max(-1,Math.min(1,(x-mapping.centerX)/mapping.radiusX)),curve=Math.sqrt(Math.max(0,1-t*t));
 const top=mapping.top.edgeY+mapping.top.ellipseDepth*curve,bottom=mapping.bottom.edgeY+mapping.bottom.ellipseDepth*curve;
 const u=.5+Math.asin(t)/mapping.assumedWrapAngleRadians+rotationTurns;
 return [((u%1)+1)%1,Math.max(0,Math.min(1,(y-top)/(bottom-top)))];
}

const cache=new Map();
async function pixels(url){
 const image=new Image();image.crossOrigin='anonymous';image.src=url;await image.decode();
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
 return {canvas,context,width:canvas.width,height:canvas.height,data:context.getImageData(0,0,canvas.width,canvas.height)};
}
// Display-only browser counterpart of product-layout.ts; production geometry is copied unchanged.
function mugPreviewPixels(art){
 const scale=MUG.mockupScale,W=Math.round(MUG.wrap.w*scale),H=Math.round(MUG.wrap.h*scale),half=Math.round(MUG.wrap.w/2*scale);
 if(Math.abs(art.width/art.height-1)>.003)throw Error('mug_picture_shape_mismatch');
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const cover=(x,width,flip)=>{const k=Math.max(width/art.width,H/art.height),w=art.width*k,h=art.height*k;ctx.save();ctx.beginPath();ctx.rect(x,0,width,H);ctx.clip();if(flip){ctx.translate(x+width,0);ctx.scale(-1,1);x=0}ctx.drawImage(art.canvas,x+(width-w)/2,(H-h)/2,w,h);ctx.restore()};
 cover(0,half,false);cover(half,W-half,true);
 const soft=document.createElement('canvas');soft.width=W;soft.height=H;const sc=soft.getContext('2d');sc.filter='blur('+Math.max(1,45*scale)+'px)';sc.drawImage(canvas,0,0);ctx.drawImage(soft,0,0);
 for(const r of mugPanelRects(scale))ctx.drawImage(art.canvas,r.x,r.y,r.w,r.h);
 const shift=(((Math.round(W/2-MUG.mockupFaceCenterX*scale))%W)+W)%W;
 const rolled=document.createElement('canvas');rolled.width=W;rolled.height=H;const rc=rolled.getContext('2d',{willReadFrequently:true});
 rc.drawImage(canvas,W-shift,0,shift,H,0,0,shift,H);rc.drawImage(canvas,0,0,W-shift,H,shift,0,W-shift,H);
 return {canvas:rolled,context:rc,width:W,height:H,data:rc.getImageData(0,0,W,H)};
}
// Display derivative only. The original generation, dimensions, hash and acceptance stay server-owned.
export async function productScene(sourceImage,artworkUrl,physicalAspect,frameColor){
 const key=sourceImage+'|'+artworkUrl+'|'+physicalAspect+'|'+(frameColor||'');if(cache.has(key))return cache.get(key);
 const task=(async()=>{
 const baseURL=new URL('.',new URL(sourceImage,location.href));
 const response=await fetch(new URL('scene.next.json',baseURL));if(!response.ok)throw Error('scene_unavailable');
 const m=await response.json();if(m.status.startsWith('blocked'))throw Error('scene_unavailable');
 const [base,mask,picture]=await Promise.all([pixels(new URL(m.sourceImage,baseURL)),pixels(new URL(m.artworkMask,baseURL)),pixels(artworkUrl)]);
 const fullWrap=m.artworkLayout==='full-wrap';
 const art=m.mapping&&!fullWrap?mugPreviewPixels(picture):picture;
 const displayAspect=fullWrap?m.surfaceAspectRatio:m.mapping?MUG.wrap.w/MUG.wrap.h:physicalAspect;
 if(Math.abs((picture.width/picture.height)/(fullWrap?m.surfaceAspectRatio:physicalAspect)-1)>.02)throw Error('scene_geometry_mismatch');
 const b=m.maskBounds,ratio=m.surfaceAspectRatio||(m.mapping?MUG.wrap.w/MUG.wrap.h:(b.x1-b.x0)/(b.y1-b.y0)),ar=art.width/art.height;
 if(Math.abs(ar/displayAspect-1)>.02||Math.abs(ratio/displayAspect-1)>.02)throw Error('scene_geometry_mismatch');
 if(base.width!==mask.width||base.height!==mask.height)throw Error('scene_mask_mismatch');
 const inverse=homography(m.cornersPixels,[[0,0],[1,0],[1,1],[0,1]]),output=base.data.data,original=new Uint8ClampedArray(output);
 // Fit without stretching: only the calibrated <=2% edge extension is mirrored.
 const rw=ar>ratio?1:ar/ratio,rh=ar>ratio?ratio/ar:1;
 const mirror=v=>v<0?-v:v>1?2-v:v;
 for(let y=0;y<base.height;y++)for(let x=0;x<base.width;x++){
  const i=(y*base.width+x)*4,k=mask.data.data[i]/255*mask.data.data[i+3]/255;if(!k)continue;
  let [u,v]=project(inverse,x,y);if(m.mapping)[u,v]=cylindricalUV(m.mapping,u,v,0);
  u=Math.max(0,Math.min(1,mirror((u-(1-rw)/2)/rw)));v=Math.max(0,Math.min(1,mirror((v-(1-rh)/2)/rh)));
  const sx=u*(art.width-1),sy=v*(art.height-1),ax=Math.floor(sx),ay=Math.floor(sy),bx=Math.min(ax+1,art.width-1),by=Math.min(ay+1,art.height-1),tx=sx-ax,ty=sy-ay;
  for(let c=0;c<3;c++){const at=(xx,yy)=>art.data.data[(yy*art.width+xx)*4+c];const sample=(at(ax,ay)*(1-tx)+at(bx,ay)*tx)*(1-ty)+(at(ax,by)*(1-tx)+at(bx,by)*tx)*ty;output[i+c]=Math.round(original[i+c]*(1-k)+sample*k);}
 }
 if(frameColor){
  if(!m.frameMask)throw Error('frame_mask_unavailable');
  const fm=await pixels(new URL(m.frameMask,baseURL)),mm=m.matteMask?await pixels(new URL(m.matteMask,baseURL)):null;
  if(fm.width!==base.width||fm.height!==base.height||mm&&(mm.width!==base.width||mm.height!==base.height))throw Error('frame_mask_mismatch');
  tintFramePixels(output,fm.data.data,mask.data.data,mm?.data.data,frameColor);
 }
 base.context.putImageData(base.data,0,0);return base.canvas.toDataURL('image/png');
 })();cache.set(key,task);try{return await task}catch(e){cache.delete(key);throw e}
}

// Product-selection photograph, before a customer artwork is available.
export async function framePhotograph(sourceImage,color='black'){
 const baseURL=new URL('.',new URL(sourceImage,location.href));
 const response=await fetch(new URL('scene.next.json',baseURL));if(!response.ok)throw Error('scene_unavailable');
 const m=await response.json();if(!m.frameMask)throw Error('frame_mask_unavailable');
 const [base,frame,art,mat]=await Promise.all([pixels(new URL(m.sourceImage,baseURL)),pixels(new URL(m.frameMask,baseURL)),pixels(new URL(m.artworkMask,baseURL)),m.matteMask?pixels(new URL(m.matteMask,baseURL)):null]);
 for(const mask of [frame,art,mat].filter(Boolean))if(mask.width!==base.width||mask.height!==base.height)throw Error('frame_mask_mismatch');
 tintFramePixels(base.data.data,frame.data.data,art.data.data,mat?.data.data,color);
 base.context.putImageData(base.data,0,0);return base.canvas.toDataURL('image/png');
}
