const test=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./support/load.cjs');
const {formatPhone}=load('lib/phone-format.ts');
for(const [input,output] of [
  ['01012345678','010-1234-5678'],['010-1234-5678','010-1234-5678'],[' 010 1234 5678 ','010-1234-5678'],
  ['1012345678','010-1234-5678'],[1012345678,'010-1234-5678'],['+82 10 1234 5678','010-1234-5678'],
  ['+82 (0)10-1234-5678','010-1234-5678'],['0212345678','02-1234-5678'],['021234567','02-123-4567'],
  ['0311234567','031-123-4567'],['07012345678','070-1234-5678'],['050712345678','0507-1234-5678'],
  ['15881234','1588-1234'],['010-****-5678','010-****-5678'],['+1 212 555 1234','+1 212 555 1234'],
  ['01012345678 내선 2','01012345678 내선 2'],['1.012345678E9','1.012345678E9'],['12345','12345'],[null,''],[undefined,''],
]) test(`phone display ${JSON.stringify(input)}`,()=>{assert.equal(formatPhone(input),output);assert.equal(formatPhone(output),output);});
const mocks={
  '@/components/admin/OrderQuickView':()=>null,'@/components/admin/ReturnsPanel':()=>null,
  '@/components/admin/SiteBadge':()=>null,'@/components/SiteContext':{useSiteKey:()=> 'blendpick'},
};
const {toOrderRows}=load('components/admin/OrdersClient.tsx',mocks);
const fixture=()=>({id:'order',order_number:'BP-test',created_at:'2026-09-28T00:00:00Z',buyer_name:'구매자',buyer_phone:'1012345678',recipient_name:'수령인',recipient_phone:'01098765432',addr_address:'테스트 주소',addr_zipcode:'01234',total_amount:23000,shipping_fee:3000,items:[{id:'item1',product_id:'p1',product_name:'상품',quantity:2},{id:'item2',product_id:'p1',product_name:'상품',quantity:1}]});
test('read-only list labels every row and retains orders without items; dispatch layout stays unchanged',()=>{
 const order={...fixture(),status:'cancelled'};
 const list=toOrderRows([order],true),dispatch=toOrderRows([order]);
 assert.ok(list.every(row=>row.length===22 && row[21]==='취소완료'));
 assert.deepEqual(list.map(row=>row.slice(0,21)),dispatch);
 const empty=toOrderRows([{...order,items:[]}],true);
 assert.equal(empty.length,1);assert.equal(empty[0][3],order.order_number);
 assert.equal(empty[0][11],'상품 정보 없음');assert.equal(empty[0][13],'');assert.equal(empty[0][21],'취소완료');
});
test('both regular and snapshot export rows format phones without mutating originals or amounts',()=>{
  const o=fixture(),before=JSON.stringify(o),rows=toOrderRows([o]);
  for(const row of rows){assert.equal(row[5],'010-1234-5678');assert.equal(row[7],'010-9876-5432');}
  assert.equal(JSON.stringify(o),before);assert.deepEqual(rows.map(r=>r[13]),[2,1]);assert.deepEqual(rows.map(r=>r[16]),[23000,'']);
  assert.deepEqual(toOrderRows(JSON.parse(JSON.stringify([o]))),rows);
  assert.equal(toOrderRows([{...o,recipient_phone:''}])[0][7],'010-1234-5678');
});
test('real xlsx download round trip keeps phone cells text and quantities numeric',async(t)=>{
  const {downloadXlsx}=load('lib/xlsx-download.ts');const XLSX=require('xlsx');
  let saved,clicked=false;const oldDocument=global.document;
  global.document={createElement:()=>({click:()=>{clicked=true;}})};
  t.after(()=>{if(oldDocument===undefined)delete global.document;else global.document=oldDocument;});
  t.mock.method(URL,'createObjectURL',blob=>{saved=blob;return 'blob:isolated-test';});
  t.mock.method(URL,'revokeObjectURL',()=>{});
  const rows=toOrderRows([fixture()]);
  await downloadXlsx('test.xlsx',Array.from({length:21},(_,i)=>String(i)),rows,'발주');
  assert.ok(clicked);const workbook=XLSX.read(await saved.arrayBuffer(),{type:'array'}),sheet=workbook.Sheets['발주'];
  assert.deepEqual([sheet.F2.t,sheet.F2.v],['s','010-1234-5678']);assert.deepEqual([sheet.H2.t,sheet.H2.v],['s','010-9876-5432']);
  assert.deepEqual([sheet.N2.t,sheet.N2.v],['n',2]);assert.deepEqual([sheet.Q2.t,sheet.Q2.v],['n',23000]);assert.equal(sheet.J2.v,'01234');
});
