/** Isolated local mockup compositor. No print-file, generation, payment or network calls. */
const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const templateRoot = path.resolve(__dirname, '../../public/gift-wizard/mockup-templates');

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
// Keep each side's edge parameter tied to the front plane, not to an independent homography's parameterization.
function mirrorSurfaceUV(frontInverse,side,x,y){
  const clamp=v=>Math.max(0,Math.min(1,v));
  const [along,deep]=project(side.inverse,x,y).map(clamp);
  const edgePoint=project(side.forward,along,0);
  const edgeUV=project(frontInverse,...edgePoint).map(clamp);
  return side.id==='left'?[deep*side.depth,edgeUV[1]]:[edgeUV[0],1-deep*side.depth];
}
const linear = v => v<=0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4;
const srgb = v => Math.round(255*Math.max(0,Math.min(1,v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055)));
async function rgb(file) {
  return sharp(file,{limitInputPixels:40000000}).rotate().flatten({background:'#ffffff'}).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true});
}
async function maskRGB(file){
  // Transparent mask pixels mean excluded, never white selected coverage.
  return sharp(file,{limitInputPixels:40000000}).flatten({background:'#000000'}).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true});
}
async function loadTemplate(templateId='classic-framed') {
  if (!['classic-framed','gallery-canvas','gallery-canvas-square','fine-art','premium-fine-art','square-framed','ceramic-mug','greeting-card'].includes(templateId)) throw Error('Uncalibrated template');
  const directory=path.join(templateRoot,templateId);
  return {directory,manifest:JSON.parse(await fs.readFile(path.join(directory,'template.next.json'),'utf8'))};
}
/**
 * Future Gift Wizard adapter input. Local paths/Buffers only; no remote fetching.
 * surfaceAspectRatio must come from selected physical orientation, not photo bounds.
 * Default cover reports source crop in metadata; mismatches require explicit allowCrop.
 * targetGeometry takes selected catalog widthIn/heightIn without silently rotating.
 * Returns PNG bytes and mockup-only metadata. Never a production print asset.
 */
async function composeProductMockup({artwork,productId='framed',templateId='classic-framed',surfaceAspectRatio,targetGeometry,fit='cover',allowCrop=false,wrap='MirrorWrap',wrapGeometry,rotationTurns=0,outputPath}) {
  if(!((productId==='card'&&templateId==='greeting-card')||(productId==='mug'&&templateId==='ceramic-mug')||(productId==='premium'&&templateId==='premium-fine-art')||(productId==='fine_art'&&templateId==='fine-art')||(productId==='framed'&&['classic-framed','square-framed'].includes(templateId))||(productId==='canvas'&&['gallery-canvas','gallery-canvas-square'].includes(templateId)))) throw Error('Unsupported product/template association');
  if(productId==='card'&&(!targetGeometry||targetGeometry.widthIn!==5||targetGeometry.heightIn!==7||fit!=='cover'))throw Error('Card visual test requires 5x7 portrait front geometry and Cover');
  if(productId==='mug'){
    if(fit!=='cover'||!wrapGeometry||wrapGeometry.widthPx!==2670||wrapGeometry.heightPx!==1110||targetGeometry||!Number.isFinite(rotationTurns))throw Error('Mug requires recorded full-wrap pixel geometry, Cover and finite rotation');
    const ratio=wrapGeometry.widthPx/wrapGeometry.heightPx;
    if(surfaceAspectRatio!==undefined&&Math.abs(surfaceAspectRatio-ratio)>1e-9)throw Error('Conflicting mug wrap geometry');
    surfaceAspectRatio=ratio;
  }
  if(templateId==='square-framed'&&(!targetGeometry||fit!=='cover')) throw Error('Square Framed requires target geometry and cover');
  if(['fine_art','premium'].includes(productId)&&(!targetGeometry||fit!=='cover')) throw Error('Fine Art requires target geometry and cover');
  if(productId==='canvas'&&(!targetGeometry||fit!=='cover'||!['MirrorWrap','none'].includes(wrap))) throw Error('Canvas requires target geometry, cover, and MirrorWrap or none');
  if(targetGeometry){
    if(!Number.isFinite(targetGeometry.widthIn)||!Number.isFinite(targetGeometry.heightIn)||targetGeometry.widthIn<=0||targetGeometry.heightIn<=0) throw Error('Invalid target artwork geometry');
    const ratio=targetGeometry.widthIn/targetGeometry.heightIn;
    if(surfaceAspectRatio!==undefined&&Math.abs(surfaceAspectRatio-ratio)>1e-9) throw Error('Conflicting target artwork geometry');
    if(['gallery-canvas-square','square-framed'].includes(templateId)&&Math.abs(ratio-1)>1e-9) throw Error('Square template requires square target geometry');
    surfaceAspectRatio=ratio;
  }
  if(!Number.isFinite(surfaceAspectRatio)||surfaceAspectRatio<=0||surfaceAspectRatio>20) throw Error('Selected product surfaceAspectRatio is required');
  if(!['contain','cover'].includes(fit)) throw Error('Unsupported artwork fit');
  const {directory,manifest:m}=await loadTemplate(templateId);
  const [base,mask,art]=await Promise.all([rgb(path.join(directory,m.sourceImage)),(templateId==='classic-framed'?rgb:maskRGB)(path.join(directory,m.artworkMask)),rgb(artwork)]);
  const {width:w,height:h}=base.info;
  if(w!==m.dimensions[0]||h!==m.dimensions[1]||mask.info.width!==w||mask.info.height!==h) throw Error('Template dimensions mismatch');
  const portrait=targetGeometry&&targetGeometry.heightIn>targetGeometry.widthIn;
  const corners=portrait?[...m.cornersPixels.slice(1),m.cornersPixels[0]]:m.cornersPixels;
  const unit=[[0,0],[1,0],[1,1],[0,1]],inverse=productId==='mug'?null:homography(corners,unit);
  const aw=art.info.width,ah=art.info.height,aspect=aw/ah;
  let rw=1,rh=1;
  if((fit==='contain')===(aspect>surfaceAspectRatio)) rh=surfaceAspectRatio/aspect; else rw=aspect/surfaceAspectRatio;
  const ox=(1-rw)/2,oy=(1-rh)/2;
  const mismatch=Math.abs(aspect/surfaceAspectRatio-1)>1e-6;
  const crop={left:Math.max(0,-ox/rw),right:Math.max(0,-ox/rw),top:Math.max(0,-oy/rh),bottom:Math.max(0,-oy/rh)};
  const geometryReport={sourceWidth:aw,sourceHeight:ah,sourceAspectRatio:aspect,targetAspectRatio:surfaceAspectRatio,targetGeometry:targetGeometry||null,templateCornerOffset:portrait?1:0,aspectRatioMismatch:mismatch,cropFractions:crop,cropPixels:{left:crop.left*aw,right:crop.right*aw,top:crop.top*ah,bottom:crop.bottom*ah},cropRequiresReview:fit==='cover'&&mismatch};
  if(fit==='cover'&&mismatch&&!allowCrop){const e=new Error('Artwork aspect ratio differs from selected product; review crop and explicitly set allowCrop to produce a review mockup');e.code='ASPECT_RATIO_MISMATCH';e.geometryReport=geometryReport;throw e;}
  let selectedPixels=0,sampledPixels=0;
  const output=Buffer.from(base.data),lut=Array.from({length:256},(_,i)=>linear(i/255));
  function sampleAt(u,v,c){
    const ax=(u-ox)/rw,ay=(v-oy)/rh;
    if(ax<0||ax>1||ay<0||ay>1) return null;
    const sx=ax*(aw-1),sy=ay*(ah-1),x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(x0+1,aw-1),y1=Math.min(y0+1,ah-1),tx=sx-x0,ty=sy-y0;
    return (lut[art.data[(y0*aw+x0)*3+c]]*(1-tx)+lut[art.data[(y0*aw+x1)*3+c]]*tx)*(1-ty)+(lut[art.data[(y1*aw+x0)*3+c]]*(1-tx)+lut[art.data[(y1*aw+x1)*3+c]]*tx)*ty;
  }
  const clamp=value=>Math.max(0,Math.min(1,value));
  let canvasMetrics=null;
  if(productId==='canvas'){
    const rawFrontInverse=homography(m.cornersPixels,unit);
    const background=await maskRGB(path.join(directory,m.backgroundMask));
    const sideData=await Promise.all(m.sides.map(async side=>{
      const decoded=await maskRGB(path.join(directory,side.mask));
      if(decoded.info.width!==w||decoded.info.height!==h) throw Error('Side mask dimensions mismatch');
      const sideInverse=homography(side.cornersPixels,unit);
      const outerMid=side.cornersPixels[2].map((v,i)=>(v+side.cornersPixels[3][i])/2);
      const outerUV=project(rawFrontInverse,...outerMid);
      const depth=side.id==='left'?-outerUV[0]:outerUV[1]-1;
      if(!(depth>0&&depth<.5)) throw Error('Unreliable side depth calibration');
      return {...side,data:decoded.data,inverse:sideInverse,forward:homography(unit,side.cornersPixels),depth};
    }));
    if(background.info.width!==w||background.info.height!==h) throw Error('Silhouette dimensions mismatch');
    canvasMetrics={wrap,depthMode:m.wrapDepthMode,depthFractions:Object.fromEntries(sideData.map(a=>[a.id,a.depth])),normalizedOverlapPixels:0,repairedGapPixels:0,maxRepairDistance:0,unassignedSilhouettePixels:0,frontPixels:0,sidePixels:0};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const index=(y*w+x)*3,shape=1-background.data[index]/255;
      if(shape<=0)continue;
      let weights=[mask.data[index],...sideData.map(a=>a.data[index])];
      if(wrap==='none')weights=[weights[0],0,0];
      let sum=weights.reduce((a,b)=>a+b,0);
      if(!sum&&wrap==='MirrorWrap'){
        // Repair only narrow raster cracks inside the supplied product silhouette.
        // Nearest supplied surface wins; larger gaps remain explicitly unresolved.
        let distance=Infinity,nearest=-1;
        for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){
          const xx=x+dx,yy=y+dy,d=Math.hypot(dx,dy);
          if(xx<0||yy<0||xx>=w||yy>=h||d>5||d>=distance)continue;
          const j=(yy*w+xx)*3,values=[mask.data[j],...sideData.map(a=>a.data[j])];
          const peak=Math.max(...values);if(peak>=128){distance=d;nearest=values.indexOf(peak)}
        }
        if(nearest>=0){weights[nearest]=255;sum=255;canvasMetrics.repairedGapPixels++;canvasMetrics.maxRepairDistance=Math.max(canvasMetrics.maxRepairDistance,distance)}
        else{canvasMetrics.unassignedSilhouettePixels++;continue}
      }
      if(!sum)continue;
      const coverage=wrap==='none'?Math.min(shape,weights[0]/255):shape;
      const frontUV=project(rawFrontInverse,x,y).map(clamp);
      const uv=[frontUV,...sideData.map(side=>{
        return mirrorSurfaceUV(rawFrontInverse,side,x,y);
      })].map(([u,v])=>portrait?[v,1-u]:[u,v]);
      selectedPixels++;sampledPixels++;
      if(weights.filter(v=>v>0).length>1)canvasMetrics.normalizedOverlapPixels++;
      if(weights[0])canvasMetrics.frontPixels++;
      if(weights[1]||weights[2])canvasMetrics.sidePixels++;
      for(let c=0;c<3;c++){
        const sample=uv.reduce((acc,p,i)=>acc+(sampleAt(...p,c)??1)*weights[i]/sum,0);
        const original=lut[base.data[index+c]];
        output[index+c]=srgb(original*(1-coverage)+original*sample*coverage);
      }
    }
  }else{
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const index=(y*w+x)*3,coverage=mask.data[index]/255;
      if(!coverage)continue;
      selectedPixels++;
      const [u,v]=productId==='mug'?cylindricalUV(m.mapping,x,y,rotationTurns):project(inverse,x,y).map(clamp);
      if(sampleAt(u,v,0)===null)continue;
      sampledPixels++;
      for(let c=0;c<3;c++){
        const original=lut[base.data[index+c]];
        output[index+c]=srgb(original*(1-coverage)+original*sampleAt(u,v,c)*coverage);
      }
    }
  }
  const png=await sharp(output,{raw:{width:w,height:h,channels:3}}).png().toBuffer();
  if(outputPath) await fs.writeFile(outputPath,png);
  return {png,metadata:{kind:'product-mockup',productionPrintFile:false,templateId,productId,width:w,height:h,fit,surfaceAspectRatio,geometryReport,...(productId==='mug'?{wrapGeometry,rotationTurns,mappingAssumption:m.mapping.assumption}:{}),selectedPixels,sampledPixels,canvasMetrics,approvalStatus:m.status}};
}
function cylindricalUV(mapping,x,y,rotationTurns=0){
 const t=Math.max(-1,Math.min(1,(x-mapping.centerX)/mapping.radiusX)),curve=Math.sqrt(Math.max(0,1-t*t));
 const top=mapping.top.edgeY+mapping.top.ellipseDepth*curve,bottom=mapping.bottom.edgeY+mapping.bottom.ellipseDepth*curve;
 const u=.5+Math.asin(t)/mapping.assumedWrapAngleRadians+rotationTurns;
 return [((u%1)+1)%1,Math.max(0,Math.min(1,(y-top)/(bottom-top)))];
}
module.exports={cylindricalUV,composeProductMockup,loadTemplate,homography,project,mirrorSurfaceUV};
