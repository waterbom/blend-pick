const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {load}=require('./support/load.cjs');
const setup=require('./support/integrity-schema.cjs');
const db=new PGlite();
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const query=(sql,params)=>db.query(sql,params);
const pool={query,connect:async()=>({query,release(){}})};
let signedIn=true;
const api=load('app/api/admin/orders/route.ts', {
  '@/lib/db-shop':pool,
  '@/lib/auth':{verifyAdminToken:async()=>signedIn?{name:'Mock admin'}:null},
  'next/headers':{cookies:async()=>({get:()=>({value:'mock'})}),headers:async()=>new Headers({host:'sanjipick.blendpunch.com'})},
});
const base='https://sanjipick.blendpunch.com/api/admin/orders';
const preview=(ids,deduct=false)=>api.GET(new Request(base+'?action=cancel_preview&orderIds='+ids.join(',')+'&deduct_shipping='+deduct));
const confirm=(ids,expected,deduct=false)=>api.PATCH(new Request(base,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({
  action:'cancel_confirm',orderIds:ids,expected_refunds:expected,deduct_shipping:deduct,dispatch_stop_confirmed:true
})}));
const originalFetch=global.fetch;
let calls=0;
before(async()=>{
  await setup(db,id);
  for(const [n,site,key,status] of [
    [1,'sanjipick','mock-1','cancel_requested'],[2,'blendpick','mock-2','cancel_requested'],
    [3,'sanjipick','SIM_3','cancel_requested'],[4,'sanjipick','mock-4','paid'],
    [5,'sanjipick','mock-5','cancel_requested'],[6,'sanjipick','mock-6','cancel_requested'],
    [7,'sanjipick','mock-7','cancel_requested'],[8,'sanjipick','mock-8','cancel_requested']
  ]) await query("INSERT INTO orders(id,site,order_type,order_number,paid_at,status,total_amount,shipping_fee,payment_key) VALUES($1,$2,'shop',$3,NOW(),$4,40000,3500,$5)",[id(n),site,'TEST-'+n,status,key]);
  await query("INSERT INTO order_refund_amounts(source_key,order_id,amount) VALUES('earlier',$1,5000)",[id(1)]);
  await query("UPDATE orders SET refund_amount_unresolved=true WHERE id=$1",[id(5)]);
  await query("INSERT INTO refund_operations(source_key,order_id,amount,baseline,reason,payment_key,total,idempotency_key) VALUES($1,$2,40000,0,'test','mock-6',40000,'isolated')",['cancel:'+id(6),id(6)]);
  global.fetch=async()=>{calls++;throw Error('Unmocked external call blocked');};
});
after(async()=>{global.fetch=originalFetch;await db.close();});
test('preview validates authentication/parameters, scopes to host, and shares exact full and net-shipping calculations',async()=>{
  signedIn=false;assert.equal((await preview([id(1)])).status,401);signedIn=true;
  assert.equal((await preview(['bad'])).status,400);
  const res=await preview([id(1)],true);
  assert.equal(res.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(await res.json(),{results:[{orderId:id(1),orderNumber:'TEST-1',amount:31500}],totalAmount:31500});
  const summary=await (await preview([id(1),id(2),id(3),id(4),id(5),id(6)])).json();
  assert.equal(summary.totalAmount,null);assert.equal(summary.results[0].amount,35000);
  assert.equal(summary.results[1].orderNumber,null);assert.ok(summary.results.slice(1).every(r=>r.amount===null&&r.error));
  assert.equal(calls,0);
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM refund_operations')).rows[0].n,1);
});
test('reviewed PATCH rejects changed amount and prior operation before contacting payment provider',async()=>{
  const stale=(await (await confirm([id(1),id(6)],{[id(1)]:31501,[id(6)]:36500},true)).json());
  assert.equal(stale.updated,0);assert.equal(stale.failed,2);assert.equal(calls,0);
  assert.deepEqual(stale.results.map(r=>r.status),['failed','failed']);
  assert.equal((await query('SELECT dispatch_stop_confirmed_at FROM orders WHERE id=$1',[id(1)])).rows[0].dispatch_stop_confirmed_at,null);
});
test('reviewed batch preserves successful/failed/skipped rows and does not retry a completed cancellation',async()=>{
  global.fetch=async(_url,opts)=>{
    calls++;
    const amount=JSON.parse(opts.body).cancelAmount;
    assert.equal(amount,36500);
    return Response.json({paymentKey:'mock-7',totalAmount:40000,balanceAmount:3500,status:'PARTIAL_CANCELED'});
  };
  const res=await (await confirm([id(7),id(8),id(4)],{[id(7)]:36500,[id(8)]:1,[id(4)]:36500},true)).json();
  assert.equal(res.updated,1);assert.equal(res.failed,1);
  assert.deepEqual(res.results.map(r=>r.status),['cancelled','failed','skipped']);
  const again=await (await confirm([id(7)],{[id(7)]:36500},true)).json();
  assert.equal(again.updated,0);assert.equal(again.results[0].status,'already_cancelled');assert.equal(calls,1);
});
