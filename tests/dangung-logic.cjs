const {test}=require('node:test'),assert=require('node:assert/strict');
const {date,days,today,quote,validateConfig}=require('../lib/dangung-core.cjs');
const config={enabled:true,extraGuestFee:20000,extraGuestUnit:'perNight',bbqFee:50000,depositAmount:100000,depositTerms:'테스트용 보증금 조건입니다. 현장에서 별도 납부합니다.',refundTerms:'테스트용 취소 환불 규정이며 실제 판매 요금에 사용하지 않습니다.',minLeadDays:1,maxNights:7};
const rows=[{day:'2026-09-15',price:450000,season:'평시',available:true},{day:'2026-09-16',price:550000,season:'성수기',available:true}],input={checkIn:'2026-09-15',checkOut:'2026-09-17',guests:8,bbq:true};
const now=new Date('2026-09-14T00:00:00Z'),q=(c=config,r=rows,i=input)=>quote(c,3,r,i,now);
test('KST date crosses midnight independently of server timezone',()=>assert.equal(today(new Date('2026-09-14T15:00:00Z')),'2026-09-15'));
test('leap dates accepted; impossible and malformed dates rejected',()=>{assert.equal(date('2028-02-29'),'2028-02-29');for(const d of ['2026-02-29','2026-09-31','2026-2-01','bad',null])assert.throws(()=>date(d));});
test('checkout is excluded including month and year boundaries',()=>{assert.deepEqual(days('2026-12-31','2027-01-02'),['2026-12-31','2027-01-01']);assert.throws(()=>days('2026-09-15','2026-09-15'));assert.throws(()=>days('2026-09-15','2026-09-14'));});
test('each night uses configured date price; add-ons included, deposit excluded',()=>{const r=q();assert.equal(r.lodging,1000000);assert.equal(r.extra,80000);assert.equal(r.bbq,50000);assert.equal(r.total,1130000);assert.equal(r.depositAmount,100000);assert.equal(r.version,3);});
test('per-stay extra guest charges once; base guests and no BBQ add nothing',()=>{assert.equal(q({...config,extraGuestUnit:'perStay'}).extra,40000);assert.equal(q(config,rows,{...input,guests:6,bbq:false}).total,1000000);});
test('unconfigured, closed and occupied nights cannot be quoted',()=>{for(const r of [rows.slice(0,1),[rows[0],{...rows[1],available:false}],[rows[0],{...rows[1],occupied:true}]])assert.throws(()=>q(config,r));assert.throws(()=>q({...config,enabled:false}));});
test('maximum guests, integers, lead time and night limit enforced',()=>{for(const guests of [0,17,6.5,'6'])assert.throws(()=>q(config,rows,{...input,guests}));assert.throws(()=>q(config,rows,{...input,checkIn:'2026-09-14'}));assert.throws(()=>q({...config,maxNights:1}));assert.throws(()=>q(config,rows,{...input,bbq:'true'}));});
test('live sales require definite extra fee basis, refund and deposit terms',()=>{for(const patch of [{extraGuestFee:null},{extraGuestUnit:''},{refundTerms:''},{depositTerms:''},{bbqFee:-1},{depositAmount:Infinity}])assert.throws(()=>validateConfig({...config,...patch}));assert.doesNotThrow(()=>validateConfig({...config,enabled:false,extraGuestFee:null,extraGuestUnit:''}));});
module.exports={config,rows,input,now};

test('approved per-reservation charges survive multi-night stay; infants are free and separate',()=>{
 const {APPROVED_SETTINGS}=require('../lib/dangung-policy.cjs');
 const r=q({...config,...APPROVED_SETTINGS},rows,{...input,infants:3,monitor:true});
 assert.equal(r.extra,40000);assert.equal(r.bbq,50000);assert.equal(r.monitor,50000);
 assert.equal(r.total,1140000);assert.equal(r.infants,3);assert.equal(r.guests,8);
 assert.deepEqual(r.selectedOptions,{bbq:true,monitor:true});assert.match(r.depositPaymentNote,/계좌이체/);
 const full=q({...config,...APPROVED_SETTINGS},rows,{...input,guests:16,infants:4,bbq:false,monitor:false});
 assert.equal(full.extra,200000);assert.equal(full.total,1200000);
});
test('server computes each add-on independently and rejects malformed new inputs',()=>{
 const c={...config,monitorFee:50000};
 assert.equal(q(c,rows,{...input,guests:6,bbq:false,monitor:true}).total,1050000);
 for(const patch of [{monitor:'true'},{monitor:1},{infants:-1},{infants:1.5},{infants:'2'},{infants:null}])assert.throws(()=>q(c,rows,{...input,...patch}));
 assert.throws(()=>q(config,rows,{...input,monitor:true}));
 assert.equal(q(config).monitor,0); // Older clients omit optional fields.
});
