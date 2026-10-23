// Copy approved bytes into the Gift Shop namespace only. No image processing.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const portrait=path.join(root,'staging/portrait-square-2026-10-22');
const pets=path.join(root,'staging/pets-square-2026-10-22');
const dest=path.join(root,'public/gift-wizard/effect-previews');
const p=JSON.parse(fs.readFileSync(path.join(portrait,'effects-manifest.staged.json')));
const m=JSON.parse(fs.readFileSync(path.join(pets,'manifest.json')));
const index={version:1,portraits:{base:'/gift-wizard/effect-previews/portraits/',effects:p.effects},pets:{base:'/gift-wizard/effect-previews/pets/',effects:{}}};
let copies=0;
function copy(source,target){fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');if(hash(source)!==hash(target))throw Error(target);copies++;}
for(const [id,entry] of Object.entries(p.effects))for(const name of new Set([entry.man,entry.woman,entry.neutral,...entry.all].filter(Boolean)))copy(path.join(portrait,'effects',id,name),path.join(dest,'portraits',id,name));
for(const job of m.jobs){const name=path.basename(job.output);copy(path.join(pets,job.output),path.join(dest,'pets',job.effect_id,name));index.pets.effects[job.effect_id]={neutral:name,all:[name]};}
fs.writeFileSync(path.join(dest,'index.next.json'),JSON.stringify(index,null,2)+'\n');
console.log(JSON.stringify({copies,portraitEntries:Object.keys(p.effects).length,petEntries:m.jobs.length}));
