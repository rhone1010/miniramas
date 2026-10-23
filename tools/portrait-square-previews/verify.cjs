// Read-only validation of staged assets and unchanged source photographs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const stage=path.resolve('staging/portrait-square-2026-10-22');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const m=JSON.parse(fs.readFileSync(path.join(stage,'manifest.json'))),lookup=JSON.parse(fs.readFileSync(path.join(stage,'effects-manifest.staged.json')));
 const problems=[],used=new Set(),counts={};let images=0;
 for(const s of m.sources)if(hash(fs.readFileSync(path.join(m.source_directory,s.filename)))!==s.sha256)problems.push('Source changed: '+s.filename);
 for(const j of m.jobs){
  counts[j.generation_status]=(counts[j.generation_status]||0)+1;
  if(!lookup.effects[j.effect_id]?.[j.variant]||!lookup.effects[j.resolved_prompt_id]?.[j.variant])problems.push('Lookup missing: '+j.effect_id+'/'+j.variant);
  if(!j.output_dimensions)continue;
  const bytes=fs.readFileSync(path.join(stage,j.output_filename)),meta=await sharp(bytes).metadata();
  if(meta.width!==meta.height||meta.width!==j.output_dimensions[0]||meta.height!==j.output_dimensions[1])problems.push('Dimensions: '+j.output_filename);
  if(hash(bytes)!==j.output_sha256)problems.push('Output hash: '+j.output_filename);
  if(j.lookup_alias&&hash(fs.readFileSync(path.join(stage,j.lookup_alias)))!==j.output_sha256)problems.push('Alias bytes: '+j.lookup_alias);
  const sidecar=JSON.parse(fs.readFileSync(path.join(stage,j.output_filename+'.json')));
  if(hash(sidecar.prompt_used)!==j.prompt_sha256)problems.push('Prompt hash: '+j.output_filename);
  images++;used.add(j.source_filename);
 }
 for(const [f,h] of Object.entries(m.engine_hashes||{}))if(hash(fs.readFileSync(path.join('lib/v1/portraits',f)))!==h)problems.push('Engine changed: '+f);
 const ledger=JSON.parse(fs.readFileSync(path.join(stage,'cost-ledger.json')));
 const estimated=ledger.reduce((n,r)=>n+(r.estimated_cost_usd??r.reserved_usd),0);
 if(estimated>20)problems.push('Budget exceeded');
 for(const j of m.jobs)if(ledger.filter(r=>r.job===j.effect_id+'/'+j.variant&&r.provider==='replicate').length>2)problems.push('Attempt limit: '+j.effect_id+'/'+j.variant);
 console.log(JSON.stringify({effects:new Set(m.jobs.map(j=>j.effect_id)).size,images,planned:m.jobs.length,sources_used:used.size,sources_supplied:m.sources.length,counts,estimated_cost_with_reserves_usd:estimated,actual_cost_usd:null,problems},null,2));
 if(problems.length)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
