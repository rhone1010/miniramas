const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),sharp=require('sharp');
const {composeProductMockup,homography,project}=require('../../product-mockup/compositor.next.cjs');
test('12x18 Fine Art portrait top follows the short physical edge, with no crop or mirror',async()=>{
 const art=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="white"/><rect width="200" height="300" fill="red"/><rect x="200" width="200" height="300" fill="lime"/><rect y="300" width="200" height="300" fill="blue"/><rect x="200" y="300" width="200" height="300" fill="yellow"/><text x="110" y="90" font-size="60">TOP</text><path d="M200 260V130M160 170L200 130L240 170" fill="none" stroke="black" stroke-width="12"/></svg>')).png().toBuffer();
 const r=await composeProductMockup({artwork:art,productId:'fine_art',templateId:'fine-art',targetGeometry:{widthIn:12,heightIn:18},allowCrop:false});
 assert.equal(r.metadata.geometryReport.templateCornerOffset,1);assert.deepEqual(r.metadata.geometryReport.cropPixels,{left:0,right:0,top:0,bottom:0});
 const m=JSON.parse(fs.readFileSync('public/gift-wizard/mockup-templates/fine-art/template.next.json'));const c=m.cornersPixels;assert.ok(Math.hypot(c[2][0]-c[1][0],c[2][1]-c[1][1])<Math.hypot(c[1][0]-c[0][0],c[1][1]-c[0][1]));
 const forward=homography([[0,0],[1,0],[1,1],[0,1]],[c[1],c[2],c[3],c[0]]),raw=await sharp(r.png).removeAlpha().raw().toBuffer({resolveWithObject:true});
 for(const [u,v,channel] of [[.2,.3,0],[.8,.3,1],[.2,.7,2]]){const [x,y]=project(forward,u,v).map(Math.round),i=(y*raw.info.width+x)*3;assert.ok(raw.data[i+channel]>raw.data[i+(channel+1)%3]+40);assert.ok(raw.data[i+channel]>raw.data[i+(channel+2)%3]+40);}
 if(process.env.GIFT_ORIENTATION_EVIDENCE){fs.mkdirSync(process.env.GIFT_ORIENTATION_EVIDENCE,{recursive:true});fs.writeFileSync(path.join(process.env.GIFT_ORIENTATION_EVIDENCE,'fine-art-12x18-directional.png'),r.png);fs.writeFileSync(path.join(process.env.GIFT_ORIENTATION_EVIDENCE,'portrait-source.png'),art);}
});
