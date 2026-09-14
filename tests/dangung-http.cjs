// Run after npm run build. Starts a production build locally; never creates orders or calls Toss.
const {test}=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),port=3218;
test('Cycle 3 local production-build HTTP smoke; live deployment still requires publication',async t=>{
 const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p',String(port)],{cwd:root,stdio:['ignore','pipe','pipe']});
 const request=(pathname,host)=>new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port,path:pathname,headers:{Host:host}},res=>{const parts=[];res.on('data',d=>parts.push(d));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(parts)}));}).on('error',reject);});
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Local server startup timeout')),15000);child.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve();}});child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);reject(Error('Local server exited '+code));});});
 let html;
 await t.test('Blendpick renders new page, sections and disabled checkout during loading',async()=>{const r=await request('/hotel/dangung','shop.blendpunch.com');assert.equal(r.status,200);html=r.body.toString();assert.match(html,/data-dangung-version="2026-09-booking-1"/);for(const id of ['four-seasons','rooms','food','memory','booking'])assert.ok(html.includes(`id="${id}"`));assert.match(html,/<fieldset disabled="">/);assert.doesNotMatch(html,/파티룸|DESIGN DRAFT/);});
 await t.test('all 22 unique photographs return exact original bytes',async()=>{const files=[...new Set([...html.matchAll(/src="(\/hotel\/dangung\/photo-\d+\.jpg)"/g)].map(m=>m[1]))];assert.equal(files.length,22);for(const file of files){const r=await request(file,'shop.blendpunch.com');assert.equal(r.status,200,file);assert.match(r.headers['content-type'],/^image\/jpeg/);assert.deepEqual(r.body,fs.readFileSync(path.join(root,'public',file)),file);}});
 await t.test('Sanjipick cannot access Dangung page, result or API',async()=>{for(const file of ['/hotel/dangung','/hotel/dangung/result','/api/dangung','/api/admin/dangung'])assert.equal((await request(file,'sanjipick.blendpunch.com')).status,404,file);});
 await t.test('admin reservation API rejects anonymous callers',async()=>assert.equal((await request('/api/admin/dangung','shop.blendpunch.com')).status,401));
 await t.test('buyer result page renders without fabricating reservation success',async()=>{const r=await request('/hotel/dangung/result','shop.blendpunch.com');assert.equal(r.status,200);assert.match(r.body.toString(),/단궁 예약 확인/);assert.doesNotMatch(r.body.toString(),/단궁 예약이 확정되었습니다/);});
 }finally{child.kill();}
});
