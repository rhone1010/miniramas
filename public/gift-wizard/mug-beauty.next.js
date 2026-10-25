import {MUG} from './backend-contracts/print/production-profiles.js';
import {mugSurface} from './mug-surface.next.js';
const cache=new Map();
async function pixels(url){
 const image=new Image();image.crossOrigin='anonymous';image.src=url;await image.decode();
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
 return {width:canvas.width,height:canvas.height,data:context.getImageData(0,0,canvas.width,canvas.height).data};
}
async function output(data,width,height){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 canvas.getContext('2d').putImageData(new ImageData(data,width,height),0,0);
 return URL.createObjectURL(await new Promise(resolve=>canvas.toBlob(resolve,'image/png')));
}
/** Input is CC's watermarked full-wrap VIEW, already centered on the primary face.
 * All three outputs share these exact pixels; only the ceramic photo is mirrored.
 * No composition strategy, source-photo handling, generation or acceptance here.
 */
export function mugBeautyViews(inputUrl){
 if(cache.has(inputUrl))return cache.get(inputUrl);
 const job=(async()=>{
  const root=new URL('./beauty-scenes/mug/',import.meta.url);
  const [base,mask,wrap,geometry]=await Promise.all([pixels(new URL('product_beauty_mug.jpeg',root)),pixels(new URL('cutout.next.svg',root)),pixels(inputUrl),fetch(new URL('surface.next.json',root)).then(r=>{if(!r.ok)throw Error('mug_geometry_unavailable');return r.json()})]);
  if(Math.abs(wrap.width/wrap.height/(MUG.wrap.w/MUG.wrap.h)-1)>.003)throw Error('mug_wrap_shape_mismatch');
  if(base.width!==mask.width||base.height!==mask.height)throw Error('mug_mask_mismatch');
  const params={base:base.data,mask:mask.data,wrap:wrap.data,width:base.width,height:base.height,wrapWidth:wrap.width,wrapHeight:wrap.height,geometry};
  const front=await output(mugSurface({...params,centerX:.5}),base.width,base.height);
  const back=await output(mugSurface({...params,centerX:.5+(MUG.faceCentersX[0]-MUG.mockupFaceCenterX)/MUG.wrap.w,mirrorBody:true}),base.width,base.height);
  // Undo only the backend VIEW roll for full-print-layout inspection; preserve all pixels.
  const unrolled=new Uint8ClampedArray(wrap.data.length),shift=Math.round((.5-MUG.mockupFaceCenterX/MUG.wrap.w)*wrap.width);
  for(let y=0;y<wrap.height;y++)for(let x=0;x<wrap.width;x++){
   const sx=((x+shift)%wrap.width+wrap.width)%wrap.width;
   unrolled.set(wrap.data.subarray((y*wrap.width+sx)*4,(y*wrap.width+sx)*4+4),(y*wrap.width+x)*4);
  }
  return {front,back,wrap:await output(unrolled,wrap.width,wrap.height)};
 })();cache.set(inputUrl,job);job.catch(()=>cache.delete(inputUrl));return job;
}

export function mugReview(views){
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const picture=(url,label)=>'<a href="'+escape(url)+'" target="_blank" rel="noopener"><img src="'+escape(url)+'" alt="'+label+'"></a>';
 return '<div class="mug-review"><div class="mug-pair">'+['front','back'].map(side=>'<figure>'+picture(views[side],side==='front'?'Front':'Back')+'<figcaption>'+(side==='front'?'Front':'Back')+'</figcaption></figure>').join('')+'</div><details><summary>View Full Wrap</summary>'+picture(views.wrap,'Complete wrap')+'</details></div>';
}
