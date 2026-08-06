const fs=require('fs'),path=require('path'),sharp=require('sharp');
const IDS=['jade','sea_glass','polished_gold','coral','tidewood','lichen_granite',
  'petal_sculpture','sandstone','watercolour','fire_face','renaissance','wild_west'];
const SRC=path.join(process.cwd(),'lib','v1','portraits','style-refs');
const OUT=path.join(process.cwd(),'public','previews','effects');
const EXT=new Set(['.jpg','.jpeg','.png','.webp']);
(async()=>{
  let n=0;
  for(const id of IDS){
    const dir=path.join(SRC,id);
    if(!fs.existsSync(dir)){console.log('MISSING FOLDER',id);continue;}
    const files=fs.readdirSync(dir).filter(f=>EXT.has(path.extname(f).toLowerCase())).sort();
    if(!files.length){console.log('EMPTY',id);continue;}
    const dest=path.join(OUT,id);
    fs.mkdirSync(dest,{recursive:true});
    for(const f of files){
      const to=path.join(dest,path.basename(f,path.extname(f))+'.jpg');
      await sharp(path.join(dir,f)).resize(400,400,{fit:'inside'})
        .jpeg({quality:70,mozjpeg:true}).toFile(to);
      n++;
    }
    console.log(id.padEnd(18),files.length,'plate(s)');
  }
  console.log('\nwrote',n,'previews to public/previews/effects/');
})();
