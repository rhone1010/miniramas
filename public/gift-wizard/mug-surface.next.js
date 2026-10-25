// Display derivative only. Wrap pixels and identity are never changed here.
// The cylindrical UV equation is the existing product-scene.next.js mapping.
export function mugSurface({base,mask,wrap,width,height,wrapWidth,wrapHeight,geometry,centerX,mirrorBody=false,panelRect=null}) {
 const out=new Uint8ClampedArray(width*height*4), b=geometry.body;
 const sample=(u,v,c)=>{
  const sx=((u%1+1)%1)*(wrapWidth-1),sy=Math.max(0,Math.min(1,v))*(wrapHeight-1),x=Math.floor(sx),y=Math.floor(sy),xx=Math.min(x+1,wrapWidth-1),yy=Math.min(y+1,wrapHeight-1),tx=sx-x,ty=sy-y;
  const at=(a,z)=>{if(panelRect){a=Math.max(panelRect.x,Math.min(panelRect.x+panelRect.w-1,a));z=Math.max(panelRect.y,Math.min(panelRect.y+panelRect.h-1,z))}return wrap[(z*wrapWidth+a)*4+c]};
  return (at(x,y)*(1-tx)+at(xx,y)*tx)*(1-ty)+(at(x,yy)*(1-tx)+at(xx,yy)*tx)*ty;
 };
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const bx=mirrorBody?width-1-x:x,i=(y*width+x)*4,j=(y*width+bx)*4,a=mask[j+3];
  if(!a)continue;
  out.set(base.subarray(j,j+3),i);out[i+3]=a;
  const px=bx/width,py=y/height,t=(px-b.centerX)/b.radiusX;
  if(Math.abs(t)>1)continue;
  const curve=Math.sqrt(Math.max(0,1-t*t)),top=b.top.edgeY+b.top.ellipseDepth*curve,bottom=b.bottom.edgeY+b.bottom.ellipseDepth*curve;
  if(py<top||py>bottom)continue;
  const displayT=mirrorBody?-t:t,u=centerX+Math.asin(displayT)/geometry.wrapAngleRadians,v=(py-top)/(bottom-top);
  // Use the photographed ceramic's white shoulder as a lighting profile.
  const lightRow=Math.round(geometry.lightingSampleY*height),li=(lightRow*width+bx)*4;
  if(panelRect){
   // The mask selects ceramic to restore; it is not a white image layer.
   // Use the same cylindrical UV mapping and backend rectangle as the print view.
   const sx=((u%1+1)%1)*(wrapWidth-1),sy=v*(wrapHeight-1);
   const inside=sx>=panelRect.x&&sx<panelRect.x+panelRect.w&&sy>=panelRect.y&&sy<panelRect.y+panelRect.h;
   for(let c=0;c<3;c++)out[i+c]=Math.round(inside?sample(u,v,c)*base[li+c]/255:base[li+c]);
   continue;
  }
  const luminance=(base[li]*.2126+base[li+1]*.7152+base[li+2]*.0722)/255;
  const shade=Math.max(.70,Math.min(1,luminance/.90));
  const gloss=Math.max(0,luminance-.90)*.50;
  for(let c=0;c<3;c++){const ink=sample(u,v,c);out[i+c]=Math.round(Math.min(255,ink*shade+(255-ink)*gloss));}
 }
 return out;
}
