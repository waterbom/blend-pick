#!/usr/bin/env node
// Synthetic post-deployment image; never reads product/customer data.
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
require('@next/env').loadEnvConfig(process.cwd());
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPioAAAAASUVORK5CYII=','base64');
// systemd active does not mean Next has begun accepting HTTP connections yet.
async function readyFetch(url) {
 const deadline=Date.now()+30000;
 let lastError;
 while(Date.now()<deadline) {
  try {
   const r=await fetch(url,{signal:AbortSignal.timeout(Math.min(5000,Math.max(1,deadline-Date.now()))),redirect:'error',cache:'no-store'});
   if(![502,503,504].includes(r.status))return r;
   lastError=Error('HTTP '+r.status);await r.body?.cancel();
  }catch(e){lastError=e;}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw Error('Image check: server did not become ready within 30 seconds ('+lastError?.message+')');
}
(async()=>{
 const dir=process.env.UPLOADS_DIR||path.join(process.cwd(),'public','uploads');
 if(!path.isAbsolute(dir))throw Error('UPLOADS_DIR must be absolute');
 const name='serving-check-'+randomUUID()+'.png',filename=path.join(dir,name);
 await fs.mkdir(dir,{recursive:true});
 // Warm the running server before adding a file: this catches startup-only public inventories.
 for(const host of ['shop.blendpunch.com','sanjipick.blendpunch.com'])await readyFetch('https://'+host+'/uploads/serving-warmup-'+randomUUID()+'.png');
 await fs.writeFile(filename,png,{flag:'wx',mode:0o644});
 try{
  for(const host of ['shop.blendpunch.com','sanjipick.blendpunch.com']){
   const r=await readyFetch('https://'+host+'/uploads/'+name);
   if(r.status!==200||r.headers.get('content-type')!=='image/png'||!Buffer.from(await r.arrayBuffer()).equals(png))throw Error(host+': uploaded image serving check failed (HTTP '+r.status+')');
   console.log('PASS '+host+': newly saved image served correctly without restart');
  }
 }finally{await fs.unlink(filename);}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
