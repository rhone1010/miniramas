/** Local visual finish test. Supplier photographic colors, not production color specifications. */
const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp');
const {composeProductMockup,loadTemplate}=require('./compositor.next.cjs');
async function composeFrameFinish({finish='black',outputPath,...request}){
 if(!['classic-framed','square-framed'].includes(request.templateId))throw Error('Frame finish requires an approved framed template');
 const references=JSON.parse(await fs.readFile(path.join(__dirname,'review/frame-finishes/references/finishes.next.json')));
 const swatch=references.finishes.find(f=>f.id===finish);if(!swatch)throw Error('Unsupported supplier finish');
 const result=await composeProductMockup({...request,productId:'framed'});
 const {directory,manifest:m}=await loadTemplate(request.templateId);
 const raw=await sharp(result.png).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const mask=async name=>{const r=await sharp(path.join(directory,name)).flatten({background:'#000'}).greyscale().removeAlpha().raw().toBuffer({resolveWithObject:true});if(r.info.width!==raw.info.width||r.info.height!==raw.info.height)throw Error('Finish mask dimensions mismatch');return r.data};
 const [frame,art,bg]=await Promise.all([mask(m.frameFinishMask||m.frameMask),mask(m.artworkMask),mask(m.backgroundMask)]);
 const out=Buffer.from(raw.data),luma=i=>.2126*raw.data[i*3]+.7152*raw.data[i*3+1]+.0722*raw.data[i*3+2];
 const values=[];for(let i=0;i<frame.length;i++)if(frame[i]>250&&!art[i]&&!bg[i])values.push(luma(i));
 if(!values.length)throw Error('Empty isolated frame mask');values.sort((a,b)=>a-b);const reference=values[Math.floor(values.length*.9)];
 let changedPixels=0;
 for(let i=0;i<frame.length;i++){
  if(finish==='black'||!frame[i]||art[i]||bg[i])continue;
  const coverage=frame[i]/255,shade=Math.pow(Math.max(0,luma(i)/Math.max(1,reference)),.55);
  for(let c=0;c<3;c++)out[i*3+c]=Math.round(raw.data[i*3+c]*(1-coverage)+Math.min(255,swatch.sampleRGB[c]*shade)*coverage);
  if(out[i*3]!==raw.data[i*3]||out[i*3+1]!==raw.data[i*3+1]||out[i*3+2]!==raw.data[i*3+2])changedPixels++;
 }
 const png=await sharp(out,{raw:raw.info}).png().toBuffer();if(outputPath)await fs.writeFile(outputPath,png);
 return {png,metadata:{...result.metadata,finish,finishVisualOnly:true,finishReference:swatch,changedPixels,shadingReference:reference,shadingExponent:.55,blackRetainsOriginal:true}};
}
module.exports={composeFrameFinish};
