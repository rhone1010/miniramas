// Local asset batch only. Calls the production engine unchanged; never writes customer records.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createRequire} from 'node:module';
import sharp from 'sharp';
import {buildEffectPrompt,hasBody} from '../../lib/v1/portraits/portraits-bodies';
import {EFFECTS} from '../../lib/v1/portraits/effect-registry';
import {resolvePresetForSubject,MAX_ATTEMPTS,evaluateSingleFaceScore} from '../../lib/v1/portraits/portraits-shared';

const root=process.cwd(),stage=path.join(root,'staging/portrait-square-2026-10-22');
const manifestPath=path.join(stage,'manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const hash=(b:Buffer|string)=>crypto.createHash('sha256').update(b).digest('hex');
const save=()=>{fs.writeFileSync(manifestPath+'.tmp',JSON.stringify(manifest,null,2));fs.renameSync(manifestPath+'.tmp',manifestPath);};
const context=new AsyncLocalStorage<any>();
const realFetch=globalThis.fetch;
const ledgerPath=path.join(stage,'cost-ledger.json');
const ledger:any[]=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,'utf8')):[];
const saveLedger=()=>fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));
const charged=()=>ledger.reduce((n,r)=>n+(r.estimated_cost_usd??r.reserved_usd),0);
const CAP=20;

function envFile(file:string){
 for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
  const m=line.match(/^\s*(?:export\s+)?(REPLICATE_API_TOKEN|OPENAI_API_KEY)\s*=\s*(.*?)\s*$/);
  if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2').replace(/\\n$/,'');
 }
}
const envIndex=process.argv.indexOf('--env-file');
if(envIndex>=0)envFile(process.argv[envIndex+1]);

// Record provider receipts without authorization headers, source payloads, or signed URLs.
globalThis.fetch=async(input:any,init:any={})=>{
 const url=new URL(typeof input==='string'?input:input.url||String(input));
 const method=(init.method||'GET').toUpperCase();
 const job=context.getStore();
 const nb=url.hostname==='api.replicate.com'&&method==='POST';
 const qa=url.hostname==='api.openai.com'&&method==='POST';
 let receipt:any;
 if(nb||qa){
  if(!job)throw Error('unattributed_paid_call');
  if(nb&&ledger.filter(r=>r.job===job.key&&r.provider==='replicate').length>=MAX_ATTEMPTS)throw Error('attempt_limit_reached');
  const payload=JSON.parse(init.body||'{}');
  if(nb&&(url.pathname!=='/v1/models/google/nano-banana-2.1/predictions'||payload.input.aspect_ratio!=='1:1'||payload.input.prompt!==job.expectedPrompt))throw Error('production_request_mismatch');
  const reserve=nb?0.0336:0.10;
  if(charged()+reserve>CAP)throw Error('approved_budget_exhausted');
  receipt={job:job.key,provider:nb?'replicate':'openai',started_at:new Date().toISOString(),reserved_usd:reserve,actual_cost_usd:null,model:nb?'google/nano-banana-2.1':payload.model,status:'submitted'};
  ledger.push(receipt);saveLedger();
 }
 const response=await realFetch(input,init);
 if(receipt){
  receipt.http_status=response.status;
  let data:any={};try{data=await response.clone().json();}catch{}
  receipt.provider_id=data.id;receipt.status=data.status||(response.ok?'completed':'failed');
  if(nb){receipt.estimated_cost_usd=response.ok?0.0336:0;receipt.metrics=data.metrics;}
  if(qa&&data.usage){
   receipt.usage=data.usage;
   const mini=String(data.model||receipt.model).startsWith('gpt-4o-mini');
   receipt.estimated_cost_usd=(data.usage.prompt_tokens*(mini?0.15:2.5)+data.usage.completion_tokens*(mini?0.6:10))/1e6;
  }
  saveLedger();
 }else if(url.hostname==='api.replicate.com'&&method==='GET'){
  let data:any;try{data=await response.clone().json();}catch{}
  const found=data?.id&&ledger.find(r=>r.provider_id===data.id);
  if(found){found.status=data.status;found.metrics=data.metrics;saveLedger();}
 }
 return response;
};

async function main(){
 const require=createRequire(path.join(root,'package.json'));
 require('openai/shims/web');
 const OpenAI=require('openai');
 if(new OpenAI({apiKey:'local-preflight-only'}).fetch!==globalThis.fetch)throw Error('usage_meter_not_attached');
 const {generatePortraitsRender,callNB2}=await import('../../lib/v1/portraits/portraits-generator');
 const active=EFFECTS.filter(e=>e.body==='live'&&!e.id.endsWith('_woman'));
 if(active.length*2!==manifest.jobs.length)throw Error('registry_changed');
 const lookup=JSON.parse(fs.readFileSync(path.join(stage,'effects-manifest.staged.json'),'utf8'));
 for(const job of manifest.jobs){
  if(!active.some(e=>e.id===job.effect_id))throw Error('inactive_effect');
  const resolved=resolvePresetForSubject(job.effect_id,job.variant);
  if(resolved!==job.resolved_prompt_id||!hasBody(resolved))throw Error('prompt_resolution_mismatch');
  if(!lookup.effects[job.effect_id]?.[job.variant]||!lookup.effects[resolved]?.[job.variant])throw Error('lookup_missing');
  const file=path.join(manifest.source_directory,job.source_filename);
  if(hash(fs.readFileSync(file))!==job.source_sha256)throw Error('source_changed');
  job.prompt_sha256=hash(buildEffectPrompt(resolved));
 }
 manifest.approval={cap_usd:20,source:'User: approved proceed',date:'2026-10-22'};
 manifest.engine_hashes=Object.fromEntries(['portraits-generator.ts','portraits-bodies.ts','portraits-shared.ts','portraits-refine.ts','style-refs.ts'].map(f=>[f,hash(fs.readFileSync(path.join(root,'lib/v1/portraits',f)))]));save();
 if(process.argv.includes('--dry-run')){console.log(JSON.stringify({jobs:manifest.jobs.length,sources:new Set(manifest.jobs.map((j:any)=>j.source_filename)).size,prompt_lookup_checks:'passed',credentials:{replicate:!!process.env.REPLICATE_API_TOKEN,openai:!!process.env.OPENAI_API_KEY},paid_calls:0}));return;}
 if(!process.env.REPLICATE_API_TOKEN||!process.env.OPENAI_API_KEY)throw Error('missing_generation_credentials');
 if(process.argv.includes('--retry-recovered')){
  const {scoreSingleFaceFidelity}=await import('../../lib/v1/portraits/portraits-refine');
  for(const job of manifest.jobs.filter((j:any)=>j.generation_status==='review_required')){
   const file=path.join(stage,job.output_filename),metadata=JSON.parse(fs.readFileSync(file+'.json','utf8'));
   const key=job.effect_id+'/'+job.variant;
   if(!metadata.recovered_prediction_id||ledger.filter(r=>r.job===key&&r.provider==='replicate').length>=MAX_ATTEMPTS)continue;
   await context.run({key,expectedPrompt:buildEffectPrompt(job.resolved_prompt_id)},async()=>{
    const source=fs.readFileSync(path.join(manifest.source_directory,job.source_filename)).toString('base64');
    const image=await callNB2({prompt:buildEffectPrompt(job.resolved_prompt_id),sourceImageB64:source,additionalImagesB64:[],styleReferenceB64s:[],aspectRatio:'1:1',replicateApiToken:process.env.REPLICATE_API_TOKEN!});
    const bytes=Buffer.from(image,'base64'),size=await sharp(bytes).metadata();
    if(!size.width||size.width!==size.height)throw Error('retry_output_not_square');
    const score=await scoreSingleFaceFidelity({sourceImageB64:source,renderedImageB64:image,openaiApiKey:process.env.OPENAI_API_KEY!}),result=evaluateSingleFaceScore(score,8);
    fs.copyFileSync(file,file+'.attempt1.jpg');fs.copyFileSync(file+'.json',file+'.attempt1.json');
    fs.writeFileSync(file,bytes);fs.writeFileSync(file+'.json',JSON.stringify({prompt_used:buildEffectPrompt(job.resolved_prompt_id),prior_attempt:metadata,score,evaluation:result,attempt:2},null,2));
    job.attempts=[{attempt:1,recovered_prediction_id:metadata.recovered_prediction_id,score:metadata.score},{attempt:2,score}];
    job.output_dimensions=[size.width,size.height];job.output_sha256=hash(bytes);job.generation_status=result.passed?'complete':'review_required';job.final_reason=result.reason;
    job.estimated_cost_usd=ledger.filter(r=>r.job===key).reduce((n,r)=>n+(r.estimated_cost_usd??r.reserved_usd),0);save();
   });
  }
  return;
 }
 if(process.argv.includes('--recover')){
  const {scoreSingleFaceFidelity}=await import('../../lib/v1/portraits/portraits-refine');
  for(const job of manifest.jobs.filter((j:any)=>['generating','interrupted'].includes(j.generation_status))){
   const key=job.effect_id+'/'+job.variant,receipt=ledger.find(r=>r.job===key&&r.provider_id);
   if(!receipt)continue;
   await context.run({key},async()=>{
    const response=await fetch('https://api.replicate.com/v1/predictions/'+receipt.provider_id,{headers:{Authorization:'Bearer '+process.env.REPLICATE_API_TOKEN}});
    const data:any=await response.json();
    if(data.status!=='succeeded')throw Error('recovery_prediction_not_succeeded');
    const url=Array.isArray(data.output)?data.output[0]:data.output;
    const bytes=Buffer.from(await (await fetch(url)).arrayBuffer()),size=await sharp(bytes).metadata();
    if(!size.width||size.width!==size.height)throw Error('recovery_output_not_square');
    const score=await scoreSingleFaceFidelity({sourceImageB64:fs.readFileSync(path.join(manifest.source_directory,job.source_filename)).toString('base64'),renderedImageB64:bytes.toString('base64'),openaiApiKey:process.env.OPENAI_API_KEY!});
    const result=evaluateSingleFaceScore(score,8);
    const file=path.join(stage,job.output_filename);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
    fs.writeFileSync(file+'.json',JSON.stringify({recovered_prediction_id:receipt.provider_id,prompt_used:data.input.prompt,score,evaluation:result},null,2));
    job.output_dimensions=[size.width,size.height];job.output_sha256=hash(bytes);job.generation_status=result.passed?'complete':'review_required';job.final_reason=result.reason;delete job.error;save();
   });
  }
  return;
 }
 for(const job of manifest.jobs){
  if(['complete','review_required','failed','interrupted'].includes(job.generation_status))continue;
  const key=job.effect_id+'/'+job.variant;
  if(job.generation_status==='generating'||ledger.some(r=>r.job===key)){
   job.generation_status='interrupted';job.error='Inspect existing provider receipts before any resubmission.';save();continue;
  }
  if(charged()+0.40>CAP){manifest.status='budget_limit';save();break;}
  const source=fs.readFileSync(path.join(manifest.source_directory,job.source_filename));
  job.generation_status='generating';save();
  await context.run({key,expectedPrompt:buildEffectPrompt(job.resolved_prompt_id)},async()=>{
   try{
    const result=await generatePortraitsRender({replicateApiToken:process.env.REPLICATE_API_TOKEN!,openaiApiKey:process.env.OPENAI_API_KEY!,request:{source_image_b64:source.toString('base64'),style_id:job.parameters.style_id,preset_id:job.effect_id,subject:job.variant,aspect_ratio:'1:1',output_aspect_ratio:'1:1',pose_id:'as_photographed'}});
    job.attempts=result.attempts;job.prompt_sha256=hash(result.prompt_used||'');
    const {image_b64,...metadata}=result;
    const file=path.join(stage,job.output_filename);fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file+'.json',JSON.stringify(metadata,null,2));
    if(!result.ok||!image_b64){job.generation_status='failed';job.error=result.fatal_error||result.final_reason;return;}
    const bytes=Buffer.from(image_b64,'base64'),size=await sharp(bytes).metadata();
    if(!size.width||size.width!==size.height)throw Error('native_output_not_square');
    fs.writeFileSync(file,bytes);job.output_dimensions=[size.width,size.height];job.output_sha256=hash(bytes);
    if(job.lookup_alias){const alias=path.join(stage,job.lookup_alias);fs.mkdirSync(path.dirname(alias),{recursive:true});fs.writeFileSync(alias,bytes);}
    job.generation_status=result.final_pass?'complete':'review_required';job.final_reason=result.final_reason;
   }catch(e:any){job.generation_status='failed';job.error=e.message;}
   finally{job.estimated_cost_usd=ledger.filter(r=>r.job===key).reduce((n,r)=>n+(r.estimated_cost_usd??r.reserved_usd),0);job.actual_cost_usd=null;save();}
  });
  console.log('BATCH',key,job.generation_status,'estimated_total_usd',charged().toFixed(4));
  if(job.generation_status==='failed')throw Error('batch_paused_for_failure: '+job.error);
 }
 if(manifest.status!=='budget_limit')manifest.status=manifest.jobs.every((j:any)=>j.generation_status==='complete')?'complete':'review_or_failures_pending';manifest.estimated_total_usd=charged();manifest.actual_total_usd=null;save();
}
main().catch(e=>{console.error('BATCH_STOP',e.message);process.exitCode=1;});
