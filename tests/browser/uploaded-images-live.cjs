// Run after a production build. Synthetic files only; no production DB or API writes.
const {spawn}=require('node:child_process'),fs=require('node:fs/promises'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPioAAAAASUVORK5CYII=','base64');
(async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'image-live-')),port=3114;const p=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{env:{...process.env,UPLOADS_DIR:dir}});let n=0;try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),20000);p.once('exit',c=>reject(Error('server exited '+c)));p.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve();}});});
 const url='http://127.0.0.1:'+port;assert.equal((await fetch(url+'/uploads/missing.png')).status,404);
 await fs.writeFile(path.join(dir,'runtime.png'),png);
 for(const host of ['shop.blendpunch.com','sanjipick.blendpunch.com']){
  for(const method of ['GET','HEAD']){const r=await fetch(url+'/uploads/runtime.png',{method,headers:{host}});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.equal(r.headers.get('content-length'),String(png.length));if(method==='GET')assert.deepEqual(Buffer.from(await r.arrayBuffer()),png);console.log('PASS',host,method,'post-start upload');n++;}
 }
 assert.equal((await fetch(url+'/uploads/missing.png')).status,404);n++;
 assert.equal((await fetch(url+'/api/admin/upload',{method:'POST'})).status,401);n++;
 console.log(`${n} production-build HTTP checks passed`);
 }finally{p.kill();await fs.rm(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
