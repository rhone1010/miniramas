const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
test('review mockup API does not intercept approved scene photography',async()=>{
 const child=spawn(process.execPath,['tools/gift-wizard/review-journey.next.cjs'],{cwd:process.cwd(),env:{...process.env,GIFT_REVIEW_PORT:'4199',GIFT_REVIEW_READY:'1',GIFT_REVIEW_COMPOSITIONS:'ready'},stdio:['ignore','pipe','pipe']});
 try {
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error('server exited '+code)));});
  const image=await fetch('http://localhost:4199/gift-wizard/mockup-scenes/fine-art-square/fine%20art%20print%20square.png');
  assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
  assert.deepEqual([...new Uint8Array(await image.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
  const mockup=await fetch('http://localhost:4199/api/v1/gift/sessions/browser-review/lines/canvas-line/mockup');
  assert.equal(mockup.headers.get('content-type'),'application/json');assert.equal((await mockup.json()).renderer,'scene');
 }finally{child.kill();}
});
