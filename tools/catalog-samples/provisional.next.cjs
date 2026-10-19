// Offline provisional-placement demonstration. Not an authenticated endpoint or approval contract.
const sharp=require('sharp');const {composeTemplateVisualTest}=require('../product-mockup/gift-visualization-adapter.next.cjs');
async function provisionalPlacement({preview,artworkId,templateId,widthIn,heightIn,size,watermarked}){
 if(watermarked!==true)throw Error('watermarked_preview_required');
 if(!Buffer.isBuffer(preview)||!artworkId)throw Error('preview_required');
 if(!(widthIn>0&&heightIn>0))throw Error('geometry_required');
 const width=720,height=Math.round(width*heightIn/widthIn);
 // Contain retains every source pixel and aspect; unused space stays paper white. Never crop or extend subjects.
 const placed=await sharp(preview).resize(width,height,{fit:'contain',background:'white'}).png().toBuffer();
 const result=await composeTemplateVisualTest({templateId,artwork:placed,artworkId,targetGeometry:{widthIn,heightIn},size,allowCrop:false});
 return {...result,provisional:true,watermarked:true,productionPrintFile:false,purchaseAuthorization:false,approvalAllowed:false,croppedPixels:0,placement:'contain'};
}
module.exports={provisionalPlacement};
