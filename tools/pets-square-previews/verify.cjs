const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve('staging/pets-square-2026-10-22'),m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))),ctx={window:{}};
vm.runInNewContext(fs.readFileSync('public/pets-registry.js','utf8'),ctx);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const errors=[];
const active=ctx.window.EFFECT_REGISTRY.effects.filter(e=>e.body==='live');
if(active.length!==m.jobs.length)errors.push('Effect coverage');
for(const j of m.jobs){
 if(ctx.window.EFFECT_REGISTRY.plateFor(j.effect_id)!=='/'+j.output)errors.push('Lookup: '+j.effect_id);
 if(j.source_sha256&&hash(fs.readFileSync(path.join(m.source_directory,j.source_filename)))!==j.source_sha256)errors.push('Source changed: '+j.effect_id);
 if(['complete','review_required'].includes(j.status)){
  if(j.dimensions?.[0]!==j.dimensions?.[1]||!j.dimensions?.[0])errors.push('Dimensions: '+j.effect_id);
  if(hash(fs.readFileSync(path.join(root,j.output)))!==j.output_sha256)errors.push('Output hash: '+j.effect_id);
 }
}
const summary={effects:active.length,statuses:m.jobs.reduce((a,j)=>(a[j.status]=(a[j.status]||0)+1,a),{}),used_sources:new Set(m.jobs.filter(j=>j.output_sha256).map(j=>j.source_filename)).size,replicate_requests:m.receipts.filter(r=>r.provider==='api.replicate.com').length,actual_cost_usd:null,cost_note:'Provider responses do not include billed dollar amounts; receipts retain provider IDs, usage and metrics.',errors};
console.log(JSON.stringify(summary,null,2));if(errors.length)process.exitCode=1;
