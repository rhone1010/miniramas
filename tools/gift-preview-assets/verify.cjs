const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..'),index=JSON.parse(fs.readFileSync(path.join(root,'public/gift-wizard/effect-previews/index.next.json')));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
(async()=>{
 assert.deepEqual(Object.keys(index),['version','portraits','pets']);
 assert.equal(index.version,1);let count=0;
 for(const series of ['portraits','pets']){
  const s=index[series];assert.equal(s.base,`/gift-wizard/effect-previews/${series}/`);
  assert.equal(Object.keys(s.effects).length,series==='portraits'?66:36);
  for(const [id,entry] of Object.entries(s.effects))for(const name of new Set([entry.man,entry.woman,entry.neutral,...entry.all].filter(Boolean))){
   const file=path.join(root,'public',s.base,id,name);
   const source=series==='portraits'?path.join(root,'staging/portrait-square-2026-10-22/effects',id,name):path.join(root,'staging/pets-square-2026-10-22/previews/pets',name);
   assert.equal(hash(file),hash(source));const meta=await sharp(file).metadata();assert.equal(meta.width,1024);assert.equal(meta.height,1024);count++;
  }
 }
 const protectedFiles=['public/previews','public/portraits.html','public/pets.html','public/groups.html','public/pets-registry.js','public/discovery-consolidated-draft.html'];
 assert.equal(cp.execFileSync('git',['diff','e804892','--',...protectedFiles],{cwd:root,encoding:'utf8'}),'');
 console.log(JSON.stringify({approvedFiles:count,dimensions:'1024x1024',identicalToApproved:true,originalSeriesUnchanged:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
