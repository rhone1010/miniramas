// Run only after the single batch writer has exited and verification has passed.
const fs=require('node:fs'),path=require('node:path');
const stage=path.resolve('staging/portrait-square-2026-10-22'),file=path.join(stage,'manifest.json');
const m=JSON.parse(fs.readFileSync(file)),ledger=JSON.parse(fs.readFileSync(path.join(stage,'cost-ledger.json')));
if(m.jobs.some(j=>!j.output_dimensions||!['complete','review_required'].includes(j.generation_status)))throw Error('Batch is not ready to finalize');
for(const j of m.jobs){
 j.estimated_cost_usd=ledger.filter(r=>r.job===j.effect_id+'/'+j.variant).reduce((n,r)=>n+(r.estimated_cost_usd??r.reserved_usd),0);
 const metadata=JSON.parse(fs.readFileSync(path.join(stage,j.output_filename+'.json')));
 if(metadata.recovered_prediction_id)j.attempts=[{attempt:1,recovered_prediction_id:metadata.recovered_prediction_id,score:metadata.score,passed:metadata.evaluation.passed}];
}
for(const s of m.sources)s.generated_uses=m.jobs.filter(j=>j.source_filename===s.filename&&j.output_dimensions).length;
if(m.sources.some(s=>!s.generated_uses))throw Error('Unused source');
m.status='staged_for_review';m.generation_complete=true;m.production_activated=false;
m.finished_at=new Date().toISOString();
m.quality_gate={passed:m.jobs.filter(j=>j.generation_status==='complete').length,review_required:m.jobs.filter(j=>j.generation_status==='review_required').length};
m.estimated_total_usd=ledger.reduce((n,r)=>n+(r.estimated_cost_usd??r.reserved_usd),0);m.actual_total_usd=null;
m.cost_note='Estimates use published rates and returned usage; includes an explicit USD0.80 reserve for initial unmetered QA. Provider billing totals were not returned.';
m.provider_generation_calls=ledger.filter(r=>r.provider==='replicate').length;
m.review_gallery='http://127.0.0.1:4318';
fs.writeFileSync(file,JSON.stringify(m,null,2));
console.log(JSON.stringify({effects:m.active_effect_tiles,images:m.jobs.length,sources:m.sources.length,...m.quality_gate,generation_calls:m.provider_generation_calls,estimated_total_usd:m.estimated_total_usd,actual_total_usd:null},null,2));
