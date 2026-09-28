// Existing end-to-end flows now pass through the public preview + commit protocol.
const {randomUUID}=require('node:crypto');
const {load}=require('./load.cjs');
process.env.ADMIN_JWT_SECRET ||= 'isolated-shipment-test-secret-not-for-production';
function shipmentApi(mocks) {
 const preview=load('app/api/admin/shipments/import/preview/route.ts',mocks);
 const commit=load('app/api/admin/shipments/import/route.ts',mocks);
 return {POST:async request=>{
  const body=await request.clone().json().catch(()=>null);
  if(!body || !Array.isArray(body.rows) || !body.rows.length) return commit.POST(request);
  const p=await preview.POST(request.clone());
  if(p.status!==200)return p;
  const data=await p.json();
  return commit.POST(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify({...body,token:data.token,requestKey:randomUUID()})}));
 }};
}
module.exports={shipmentApi};
