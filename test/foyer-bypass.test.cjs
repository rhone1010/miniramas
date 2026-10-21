const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Module=require('node:module');
const ts=require('typescript');
const filename=require('node:path').resolve('middleware.ts');
const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;mod._compile(compiled,filename);
const request=async(path)=>mod.exports.middleware({nextUrl:new URL(path,'https://navigation.test')});
test('home and series enter approved pages without extra history hops or lost context',async()=>{
 for(const [path,page] of Object.entries({'/':'homepage.next.html','/home':'homepage.next.html','/portraits':'discovery-consolidated-draft.html','/discovery':'discovery-consolidated-draft.html','/groups':'groups.html','/pets':'pets.html','/pets/discovery':'pets.html','/pets/portraits':'pets.html'})){
  const response=await request(path+'?foyerFrom=portraits&piece=existing&return=%2Fcollection');
  assert.equal(response.headers.get('location'),null);
  const target=new URL(response.headers.get('x-middleware-rewrite'));
  assert.equal(target.pathname,'/'+page);
  assert.equal(target.search,'?foyerFrom=portraits&piece=existing&return=%2Fcollection');
  assert.equal(response.headers.get('set-cookie'),null);
 }
});
test('legacy Foyer direct and return links redirect to Discovery with context intact',async()=>{
 for(const [path,target] of Object.entries({'/foyer.html':'/portraits','/pets-foyer.html':'/pets/discovery','/groups-foyer.html':'/groups','/groups/foyer':'/groups'})){
  const response=await request(path+'/?foyerFrom=pets&piece=existing');
  assert.equal(response.status,307);
  assert.equal(response.headers.get('location'),'https://navigation.test'+target+'?foyerFrom=pets&piece=existing');
  assert.equal(response.headers.get('set-cookie'),null);
 }
});
test('photo redirect destinations preserve the source series without returning to a Foyer',()=>{
 for(const file of ['public/upload-routing.next.js','public/upload-routing.deep-review.next.next.js']){
  const source=fs.readFileSync(file,'utf8');
  const expression=source.match(/var destination=([^;]+);/)[1];
  const route=new Function('paths','target','current','api', 'return '+expression);
  for(const target of ['portraits','pets','groups'])for(const from of ['portraits','pets','groups']){
   const paths={portraits:'/discovery',pets:'/pets/discovery',groups:'/groups'};
   for(const foyer of [true,false])assert.equal(route(paths,target,{series:from},{foyer}),paths[target]+'?foyerFrom='+from);
  }
  assert.ok(source.includes('LitenHandoff.put(current.photo,info).then(function(){window.location.assign(destination);}'));
 }
});
