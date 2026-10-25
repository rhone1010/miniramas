// Display derivative only. Wrap pixels and identity are never changed here.
// The cylindrical UV equation is the existing product-scene.next.js mapping.
export function mugSurface({base,mask,wrap,width,height,wrapWidth,wrapHeight,geometry,centerX,mirrorBody=false}) {
 const out=new Uint8ClampedArray(width*height*4), b=geometry.body;
 const sample=(u,v,c)=>{
  const sx=((u%1+1)%1)*(wrapWidth-1),sy=Math.max(0,Math.min(1,v))*(wrapHeight-1),x=Math.floor(sx),y=Math.floor(sy),xx=Math.min(x+1,wrapWidth-1),yy=Math.min(y+1,wrapHeight-1),tx=sx-x,ty=sy-y;
  const at=(a,z)=>wrap[(z*wrapWidth+a)*4+c];
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
  const luminance=(base[li]*.2126+base[li+1]*.7152+base[li+2]*.0722)/255;
  const shade=Math.max(.70,Math.min(1,luminance/.90));
  const gloss=Math.max(0,luminance-.90)*.50;
  for(let c=0;c<3;c++){const ink=sample(u,v,c);out[i+c]=Math.round(Math.min(255,ink*shade+(255-ink)*gloss));}
 }
 return out;
}
