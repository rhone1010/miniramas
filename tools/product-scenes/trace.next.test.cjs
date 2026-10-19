// Run after next build: checks the emitted route bundle rather than merely its configuration.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('emitted mockup function trace includes every approved scene runtime dependency',()=>{
 const trace=path.resolve('.next/server/app/api/v1/gift/sessions/[id]/lines/[lineId]/mockup/route.js.nft.json');
 assert.ok(fs.existsSync(trace),'Run next build before this test');
 const files=new Set(JSON.parse(fs.readFileSync(trace)).files.map(f=>path.resolve(path.dirname(trace),f).toLowerCase()));
 for(const f of JSON.parse(fs.readFileSync('tools/product-scenes/bundle.next.json')).files)assert.ok(files.has(path.resolve(f.path).toLowerCase()),'Missing emitted dependency: '+f.path);
});
