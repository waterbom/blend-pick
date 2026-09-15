const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {nightlyPrice,PRICING_PLAN}=require('../lib/dangung-pricing.cjs');
const {roll}=require('../scripts/roll-dangung-calendar.cjs');
const {APPROVED_SETTINGS}=require('../lib/dangung-policy.cjs');
const {service}=require('../lib/dangung-core.cjs');
test('approved nightly prices: boundaries, Friday/Saturday stacking, summer and year-end',()=>{
 for(const [day,price] of [
 ['2026-09-16',450000],['2026-09-18',550000],['2026-09-19',550000],['2026-09-20',450000],
 ['2027-07-14',450000],['2027-07-15',550000],['2027-07-16',650000],['2027-07-24',650000],
 ['2027-07-25',600000],['2027-07-30',700000],['2027-08-09',600000],['2027-08-10',550000],['2027-08-24',550000],['2027-08-25',450000],
 ['2026-12-23',450000],['2026-12-24',550000],['2026-12-25',550000],['2026-12-31',550000],['2027-01-01',550000],['2028-02-29',450000]
 ])assert.equal(nightlyPrice(day).price,price,day);
 assert.throws(()=>nightlyPrice('2027-02-29'));assert.throws(()=>nightlyPrice('garbage'));
 // Peak wins if a future editor overlaps annual ranges; no +100k/+150k double season charge.
 assert.equal(nightlyPrice('2027-07-30',{...PRICING_PLAN,shoulderRanges:[['07-01','08-31']]}).price,700000);
});
test('sale launch is atomic; rolling dates preserve pauses, overrides and booked quote amounts',async t=>{
 const db=new PGlite();let failUpdate=false;
 const query=async(sql,args)=>{if(failUpdate&&sql.startsWith('UPDATE dangung_settings')){failUpdate=false;throw Error('simulated write failure');}return db.query(sql,args);};
 const pool={query,connect:async()=>({query,release(){}})};
 const now=new Date('2026-09-15T01:00:00Z');
 try{
  await db.exec(fs.readFileSync('scripts/dangung.sql','utf8'));
  const {rows:[s]}=await db.query('SELECT config FROM dangung_settings WHERE id=1');
  await db.query('UPDATE dangung_settings SET config=$1',[JSON.stringify({...s.config,...APPROVED_SETTINGS})]);
  await t.test('scheduled extension never opens a not-yet-launched sale',async()=>{
   assert.equal((await roll(pool,{now})).skipped,true);
   assert.equal((await db.query('SELECT count(*)::int n FROM dangung_dates')).rows[0].n,0);
  });
  await t.test('failure rolls back date generation and sale activation together',async()=>{
   failUpdate=true;await assert.rejects(roll(pool,{launch:true,now}));
   assert.equal((await db.query('SELECT count(*)::int n FROM dangung_dates')).rows[0].n,0);
   assert.equal((await db.query('SELECT config FROM dangung_settings')).rows[0].config.enabled,false);
  });
  await t.test('launch opens September 16 onward with 365 priced nights',async()=>{
   const r=await roll(pool,{launch:true,now});assert.equal(r.opened,true);assert.equal(r.enabled,true);assert.equal(r.inserted,365);assert.equal(r.first,'2026-09-16');assert.equal(r.last,'2027-09-15');
   const api=service(pool,{}, {now:()=>now});
   const q=await api.getQuote({checkIn:'2026-09-18',checkOut:'2026-09-21',guests:8,infants:2,bbq:true,monitor:true});
   assert.equal(q.lodging,1550000);assert.equal(q.extra,40000);assert.equal(q.total,1690000);assert.equal(q.depositAmount,100000);
   const {randomUUID}=require('node:crypto');
   const rsv=await api.reserve({...q,buyerName:'격리테스트',buyerPhone:'01000000000',memo:'',requestId:randomUUID(),bbq:true,monitor:true,amount:q.total,agreed:true},'isolated-owner');
   await api.setDates({start:'2026-09-18',end:'2026-09-19',weekdayPrice:770000,weekendPrice:770000,season:'관리자 수정',available:false});
   await roll(pool,{launch:true,now});
   assert.equal((await api.status(rsv.id,'isolated-owner')).amount,1690000);
  });
  await t.test('repeated deploy is idempotent and does not reopen admin-paused sales or dates',async()=>{
   await db.query("UPDATE dangung_settings SET config=jsonb_set(config,'{enabled}','false')");
   const before=(await db.query('SELECT version FROM dangung_settings')).rows[0].version;
   const r=await roll(pool,{launch:true,now});assert.equal(r.enabled,false);assert.equal(r.inserted,0);assert.equal(r.opened,false);
   assert.equal((await db.query('SELECT version FROM dangung_settings')).rows[0].version,before);
   const d=(await db.query("SELECT * FROM dangung_dates WHERE day='2026-09-18'")).rows[0];assert.equal(d.price,770000);assert.equal(d.available,false);
  });
  await t.test('next-day extension uses KST and inserts only one new night without enabling sale',async()=>{
   const r=await roll(pool,{now:new Date('2026-09-15T15:00:00Z')});assert.equal(r.first,'2026-09-17');assert.equal(r.last,'2027-09-16');assert.equal(r.inserted,1);assert.equal(r.enabled,false);
  });
 }finally{await db.close();}
});
