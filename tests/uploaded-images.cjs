const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {load}=require('./support/load.cjs');
const {NextRequest}=require('next/server');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPioAAAAASUVORK5CYII=','base64');
let dir,old;
test.before(async()=>{old=process.env.UPLOADS_DIR;dir=await fs.mkdtemp(path.join(os.tmpdir(),'blendpick-images-'));process.env.UPLOADS_DIR=dir;});
test.after(async()=>{if(old===undefined)delete process.env.UPLOADS_DIR;else process.env.UPLOADS_DIR=old;await fs.rm(dir,{recursive:true,force:true});});
const storage=load('lib/uploaded-images.ts');
const reader=load('app/api/uploaded-images/[...path]/route.ts');
const read=url=>reader.GET(new Request('http://localhost'+url),{params:Promise.resolve({path:url.replace('/uploads/','').split('/')})});
const auth={'next/headers':{cookies:async()=>({get:()=>({value:'synthetic-admin'})})},'@/lib/auth':{verifyAdminToken:async()=>({id:'test'})}};
const upload=load('app/api/admin/upload/route.ts',auth).POST;
const request=file=>{const body=new FormData();body.set('file',file);return new Request('http://localhost/api/admin/upload',{method:'POST',body});};
test('representative, sub and editor uploads create files and return immediately readable bytes',async()=>{
 for(const name of ['representative.jpg','sub','detail.php']){
  const res=await upload(request(new File([png],name,{type:'image/png'})));assert.equal(res.status,200);const {url}=await res.json();assert.match(url,/^\/uploads\/[a-f0-9-]+\.png$/);
  assert.deepEqual(await fs.readFile(path.join(dir,path.basename(url))),png);
  const image=await read(url);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
 }
});
test('all public upload folders share configured storage',async()=>{
 for(const folder of ['reviews','returns']){const url=await storage.saveUploadedImage(new File([png],'test.png',{type:'image/png'}),folder);assert.equal((await read(url)).status,200);}
});
test('both domains preserve saved /uploads URLs through an on-demand rewrite',()=>{
 const {proxy}=load('proxy.ts');for(const host of ['shop.blendpunch.com','sanjipick.blendpunch.com']){const r=proxy(new NextRequest('https://'+host+'/uploads/test.png',{headers:{host}}));assert.equal(new URL(r.headers.get('x-middleware-rewrite')).pathname,'/api/uploaded-images/test.png');}
});
test('missing files are 404 and not cached',async()=>{const r=await read('/uploads/missing.png');assert.equal(r.status,404);assert.equal(r.headers.get('cache-control'),'no-store');});
test('reject traversal, encoded traversal, non-image and nested escape paths',async()=>{
 for(const parts of [['..','outside.png'],['%2e%2e','file.png'],['/etc','x.png'],['file.html'],['a/b.png'],['.','x.png']])assert.equal(await storage.readUploadedImage(parts),null);
});
test('symlinks cannot expose files outside storage root',async()=>{const outside=dir+'-outside.png';await fs.writeFile(outside,png);try{await fs.symlink(outside,path.join(dir,'escape.png'));assert.equal(await storage.readUploadedImage(['escape.png']),null);}finally{await fs.unlink(outside);}});
test('storage unavailable returns 503 and never claims upload success',async()=>{const previous=process.env.UPLOADS_DIR;process.env.UPLOADS_DIR=path.join(dir,'not-directory');await fs.writeFile(process.env.UPLOADS_DIR,'x');try{assert.equal((await upload(request(new File([png],'x.png',{type:'image/png'})))).status,503);}finally{process.env.UPLOADS_DIR=previous;}});
test('reject malformed form, text file field, unsupported image and oversized files',async()=>{
 assert.equal((await upload(new Request('http://localhost',{method:'POST',body:'invalid'}))).status,400);
 assert.equal((await upload(request('not-a-file'))).status,400);
 assert.equal((await upload(request(new File(['<svg/>'],'x.svg',{type:'image/svg+xml'})))).status,400);
 const oversized={formData:async()=>new Map([['file',{size:51*1024*1024,type:'image/png'}]])};assert.equal((await upload(oversized)).status,413);
});
test('upload rejects missing admin before reading body',async()=>{const POST=load('app/api/admin/upload/route.ts',{'next/headers':{cookies:async()=>({get:()=>undefined})},'@/lib/auth':{verifyAdminToken:async()=>null}}).POST;assert.equal((await POST({formData:()=>{throw Error('must not read');}})).status,401);});
test('legacy public uploads remain readable when storage directory changes',async()=>{
 const legacy=path.join(process.cwd(),'public/uploads'),name='legacy-test-'+Date.now()+'.png';await fs.mkdir(legacy,{recursive:true});await fs.writeFile(path.join(legacy,name),png);
 try{assert.deepEqual((await storage.readUploadedImage([name])).data,png);}finally{await fs.unlink(path.join(legacy,name));}
});
