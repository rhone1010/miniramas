/** Display-only masked single-panel mug. No print layout or artwork mutation. */
export function mugPanelPixels({base,mask,art,width,height,artWidth,artHeight,panel}){
 const out=new Uint8ClampedArray(base),ratio=artWidth/artHeight;
 const pw=Math.min(panel.maxWidth,panel.maxHeight*ratio),ph=pw/ratio;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,k=mask[i]/255*mask[i+3]/255;if(!k)continue;
  const t=(x-panel.centerX)/panel.radiusX;if(Math.abs(t)>=1)continue;
  const arc=Math.asin(t)*panel.radiusX,curve=Math.sqrt(1-t*t);
  const u=arc/pw+.5,v=(y-panel.centerY-panel.curveDepth*(curve-1))/ph+.5;
  const light=(Math.round(panel.lightRow)*width+x)*4;
  const shade=Math.max(.7,Math.min(1,(base[light]+base[light+1]+base[light+2])/(3*240)));
  for(let c=0;c<3;c++){
   let value=base[light+c];
   if(u>=0&&u<=1&&v>=0&&v<=1){
    const sx=u*(artWidth-1),sy=v*(artHeight-1),ax=Math.floor(sx),ay=Math.floor(sy),bx=Math.min(ax+1,artWidth-1),by=Math.min(ay+1,artHeight-1),tx=sx-ax,ty=sy-ay;
    const at=(xx,yy)=>art[(yy*artWidth+xx)*4+c];
    const ink=(at(ax,ay)*(1-tx)+at(bx,ay)*tx)*(1-ty)+(at(ax,by)*(1-tx)+at(bx,by)*tx)*ty;
    value=ink*shade+(255-ink)*Math.max(0,shade-.95)*.12;
   }
   out[i+c]=Math.round(base[i+c]*(1-k)+value*k);
  }
 }
 return out;
}
const cache=new Map();
export async function mugPanelPreview(artworkUrl,panel){
 // Placement must come from the agreed scene/print contract. Never infer print geometry here.
 if(!panel||!['centerX','centerY','radiusX','maxWidth','maxHeight','curveDepth','lightRow'].every(k=>Number.isFinite(panel[k])))throw Error('mug_panel_geometry_required');
 const key=artworkUrl+'|'+JSON.stringify(panel);if(cache.has(key))return cache.get(key);
 const job=(async()=>{
  const read=async url=>{const image=new Image();image.crossOrigin='anonymous';image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);return {canvas,context,width:canvas.width,height:canvas.height,data:context.getImageData(0,0,canvas.width,canvas.height)}};
  const root=new URL('./beauty-scenes/mug/',import.meta.url);
  const [base,mask,art]=await Promise.all([read(new URL('product_beauty_mug.jpeg',root)),read(new URL('artwork-mask.svg',root)),read(artworkUrl)]);
  if(mask.width!==base.width||mask.height!==base.height)throw Error('mug_mask_mismatch');
  const data=mugPanelPixels({base:base.data.data,mask:mask.data.data,art:art.data.data,width:base.width,height:base.height,artWidth:art.width,artHeight:art.height,panel});
  base.context.putImageData(new ImageData(data,base.width,base.height),0,0);
  return URL.createObjectURL(await new Promise(resolve=>base.canvas.toBlob(resolve,'image/png')));
 })();cache.set(key,job);try{return await job}catch(e){cache.delete(key);throw e}
}
