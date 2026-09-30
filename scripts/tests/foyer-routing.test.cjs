const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const root = process.env.FOYER_TEST_ROOT || 'public';
const read = name => fs.readFileSync(root + '/' + name.replace(/(\.[^.]+)$/, root === 'public' ? '$1' : '.next$1'), 'utf8');
const photo = 'data:image/jpeg;base64,YWJj';
const flush = async () => { for (let i=0;i<15;i++) await new Promise(setImmediate); };
function storage() {
  const meta = new Map(), databases = new Map();
  return {
    localStorage: { getItem:k=>meta.get(k)||null, setItem:(k,v)=>meta.set(k,v), removeItem:k=>meta.delete(k) },
    indexedDB: { open(name) {
      const rq = {};
      setImmediate(()=>{
        const fresh = !databases.has(name);
        if(fresh) databases.set(name,new Map());
        const values = databases.get(name);
        rq.result = { createObjectStore(){}, close(){}, transaction() {
          const t = {};
          function request(action) { const r={}; setImmediate(()=>{r.result=action();r.onsuccess();t.oncomplete();});return r; }
          t.objectStore=()=>({put:(v,k)=>request(()=>values.set(k,v)),get:k=>request(()=>values.get(k)),delete:k=>request(()=>values.delete(k))});
          return t;
        }};
        if(fresh) rq.onupgradeneeded(); rq.onsuccess();
      }); return rq;
    }}
  };
}
function page(series, store, target, search='') {
  let mounted=false;
  const elements = new Map();
  const element = id => {
    if(!elements.has(id)) elements.set(id,{classList:{add(){},remove(){}},setAttribute(){},addEventListener(){}});
    return elements.get(id);
  };
  const requests=[], settlements=[], navigation=[];
  const c = vm.createContext({ ...store, Blob, Uint8Array, atob, URLSearchParams, console,
    FileReader: class { readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onload();});} },
    document:{getElementById:id=>id==='uploadRoutingModal'&&!mounted?null:element(id),createElement:()=>({}),body:{appendChild(){mounted=true;}}},
    location:{search,assign:url=>navigation.push(url)},
    FOYER:{free:true,why:null,intake:null,handoff:null,run:0}, SRC:{dataUrl:photo,b64:'YWJj'}, STATE:{phase:'opening'},
    setFoyerSubject(){},showRevealStatus(){},generationReady:r=>{c.result=r;},settle:s=>settlements.push(s),
    begin:url=>{c.begun=url;c.STATE.phase='photo';},
    foyerPost:async(url,body)=>{
      requests.push({url,body});
      return url.endsWith('/intake') ? {status:'ok',intake:'signed-'+series,routing:{decisions:{[series]:{match:series===target,redirectSeries:target,ctaLabel:'Step Inside',stayLabel:'Craft anyway'}}}} : {status:'ok',image:'usable-preview',label:'existing-label'};
    }
  });
  c.window=c;
  vm.runInContext(read(series==='pets'?'pets-discovery-handoff.js':'foyer-handoff.js'),c);
  vm.runInContext(read('upload-routing.js'),c);
  c.LitenSubjectGate.foyer=series;
  const html=read(series==='pets'?'pets-foyer.html':'foyer.html');
  vm.runInContext(html.slice(html.indexOf('function askIntake(){'),html.indexOf('/* THE PERSISTENT STATUS')),c);
  vm.runInContext(html.slice(html.indexOf('function reveal(){'),html.indexOf('/* ── WHEN THERE IS NO REVEAL')),c);
  return {c,requests,settlements,navigation,click:id=>element(id).onclick(),restore(){vm.runInContext(html.slice(html.indexOf('/* Resume the fitted photograph'),html.lastIndexOf('</script>')),c);}};
}
for(const [source,target,path] of [['portraits','pets','/pets'],['pets','portraits','/']]) {
  test(source+' → '+target+' preserves bytes and only destination requests a preview',async()=>{
    const store=storage(), from=page(source,store,target);
    from.c.reveal(); await flush();
    assert.equal(from.c.LitenSubjectGate.pending,true);
    assert.equal(from.requests.filter(r=>r.url.endsWith('/reveal')).length,0);
    from.click('uploadRoutingNew');
    // A second action during the write must not start a source render.
    from.click('uploadRoutingAnyway');
    await flush();
    assert.deepEqual(from.navigation,[path+'?foyerFrom='+source]);
    assert.equal(from.requests.filter(r=>r.url.endsWith('/reveal')).length,0);
    const to=page(target,store,target,'?foyerFrom='+source);
    to.restore(); await flush();
    assert.equal(to.c.begun,photo);
    assert.equal(to.c.result.src,'usable-preview');
    assert.equal(to.requests.filter(r=>r.url.endsWith('/reveal')).length,1);
    assert.ok(to.requests.every(r=>r.body.image_b64==='YWJj'));
    assert.equal(await to.c.LitenHandoff.take(source),null);
  });
  test(source+' closing the routing gate preserves availability and allows retry',async()=>{
    const p=page(source,storage(),target);
    p.c.reveal(); await flush();p.click('uploadRoutingX');await flush();
    assert.equal(p.c.FOYER.free,true);assert.equal(p.c.FOYER.why,null);assert.equal(p.c.FOYER.intake,null);
    assert.deepEqual(p.settlements,['failed']);
    assert.equal(p.requests.filter(r=>r.url.endsWith('/reveal')).length,0);
    p.c.reveal();await flush();p.click('uploadRoutingAnyway');await flush();
    assert.equal(p.c.result.src,'usable-preview');
  });
  test(source+' Craft it here anyway retains the original flow',async()=>{
    const p=page(source,storage(),target);
    p.c.reveal();await flush();p.click('uploadRoutingAnyway');await flush();
    assert.equal(p.c.LitenSubjectGate.skipRedirect,true);
    assert.equal(p.requests.filter(r=>r.url.endsWith('/reveal')).length,1);
    assert.equal(p.c.result.src,'usable-preview');assert.deepEqual(p.navigation,[]);
  });
}
test('changed scripts parse and approved markup/styles stay identical',()=>{
  for(const file of ['foyer.html','pets-foyer.html']) {
    const edited=read(file), original=fs.readFileSync('public/'+file,'utf8');
    const stripScripts=s=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
    assert.equal(stripScripts(edited),stripScripts(original));
    for(const m of edited.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
  }
  for(const file of ['upload-routing.js','foyer-handoff.js','pets-discovery-handoff.js']) new vm.Script(read(file));
});
