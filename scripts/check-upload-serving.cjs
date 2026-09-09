#!/usr/bin/env node
// Synthetic post-deployment image; never reads product/customer data.
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
require('@next/env').loadEnvConfig(process.cwd());
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPioAAAAASUVORK5CYII=','base64');
(async()=>{
 const dir=process.env.UPLOADS_DIR||path.join(process.cwd(),'public','uploads');
 if(!path.isAbsolute(dir))throw Error('UPLOADS_DIR must be absolute');
 const name='serving-check-'+randomUUID()+'.png',filename=path.join(dir,name);
 await fs.mkdir(dir,{recursive:true});
 // Warm the running server before adding a file: this catches startup-only public inventories.
 for(const host of ['shop.blendpunch.com','sanjipick.blendpunch.com'])await fetch('https://'+host+'/uploads/serving-warmup-'+randomUUID()+'.png',{signal:AbortSignal.timeout(10000)});
 await fs.writeFile(filename,png,{flag:'wx',mode:0o644});
 try{
  for(const host of ['shop.blendpunch.com','sanjipick.blendpunch.com']){
   const r=await fetch('https://'+host+'/uploads/'+name,{signal:AbortSignal.timeout(15000),redirect:'error',cache:'no-store'});
   if(r.status!==200||r.headers.get('content-type')!=='image/png'||!Buffer.from(await r.arrayBuffer()).equals(png))throw Error(host+': uploaded image serving check failed (HTTP '+r.status+')');
   console.log('PASS '+host+': newly saved image served correctly without restart');
  }
 }finally{await fs.unlink(filename);}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
