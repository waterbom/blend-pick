const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {PGlite}=require('@electric-sql/pglite');
const {load}=require('./support/load.cjs');
const [crab,corn]=load('lib/sanji-offer-copy.ts').SANJI_SCOPED_OFFER_IDS;
const legacy='정품연지홍게 프리미엄급 다리수율 80%이상 포항 구룡포 대게';
const cornLegacy='국내산 無첨가물 진공 초당 옥수수 & 초당 옥수수';
const {sanjiOfferName,sanjiPriceBasis}=load('lib/sanji-offer-copy.ts');
const makeOption=(name,price,props={})=>({id:name,name,value:'',extra_price:price,is_active:true,stock:5,...props});

test('legacy names are corrected only for the two intended product IDs, and later catalog edits win',()=>{
 assert.equal(sanjiOfferName(crab,legacy),'연지홍게');
 assert.equal(sanjiOfferName(corn,cornLegacy),'진공 초당·찰옥수수');
 assert.equal(sanjiOfferName(crab,'새 제목'),'새 제목');
 assert.equal(sanjiOfferName('other',legacy),legacy);
});

test('a basis only comes from one exact eligible option, never from a cheaper or unavailable one',()=>{
 const target=makeOption('찰옥수수 10개입',26900);
 const other=makeOption('초당 10개입',28900);
 assert.equal(sanjiPriceBasis(26900,[other,target,makeOption('품절',26900,{stock:0}),makeOption('숨김',26900,{is_active:false})]),target.name);
 assert.equal(sanjiPriceBasis(28900,[other,target]),other.name);
 assert.equal(sanjiPriceBasis(26900,[other]),null);
 assert.equal(sanjiPriceBasis(26900,[target,{...other,extra_price:26900}]),null);
 assert.equal(sanjiPriceBasis(26900,[{...target,extra_price:null,stock:-1}]),target.name);
});

test('catalog SQL excludes removed/inactive/depleted options, leaves prices unchanged, and detects ties',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE TABLE products_shop(id uuid PRIMARY KEY,name text,brand text,category text,price integer,original_price integer,main_image text,stock integer,status text,sale_start_at timestamp,sale_end_at timestamp,created_at timestamp,is_visible boolean);
   CREATE TABLE product_options(product_id uuid,name text,value text,stock integer,is_active boolean,extra_price integer,removed_at timestamp);
   CREATE TABLE orders(id integer,status text); CREATE TABLE order_items(order_id integer,product_id uuid,quantity integer);
   CREATE TABLE product_images(product_id uuid,url text,sort_order integer);`);
  const data=load('lib/sanji-data.ts',{'@/lib/db-shop':db,'@/lib/db':db});
  await db.query("INSERT INTO products_shop VALUES ($1,$2,'산지픽','산지픽 해산물',38900,100000,null,3,'active',null,null,NOW(),true),($3,$4,'클래식농원','산지픽 농산물',26900,50000,null,30,'active',null,null,NOW(),true)",[crab,legacy,corn,cornLegacy]);
  await db.query("INSERT INTO product_options VALUES ($1,'실속형 3kg','',3,true,38900,null),($1,'고급형 3kg','',3,true,47900,null),($1,'삭제','',3,true,38900,NOW()),($2,'찰옥수수 10개입','',3,true,26900,null),($2,'품절','',0,true,26900,null),($2,'미사용','',3,false,26900,null)",[crab,corn]);
  const products=await data.getSanjiProducts({includeImages:true});
  assert.deepEqual(products.map(p=>[p.name,p.price,p.price_basis]).sort(),[['연지홍게',38900,'실속형 3kg'],['진공 초당·찰옥수수',26900,'찰옥수수 10개입']]);
  await db.query("INSERT INTO product_options VALUES ($1,'같은 가격','',1,true,38900,null)",[crab]);
  assert.equal((await data.getSanjiProducts()).find(p=>p.id===crab).price_basis,null);
 } finally {await db.close();}
});

test('detail and card show the option beside the literal price, avoid unverified discount, and fall back safely',()=>{
 const mocks={'next/navigation':{useRouter:()=>({push(){}})}};
 const View=load('components/sanji/SanjiSalesPage.tsx',mocks).default;
 const Card=load('components/sanji/SanjiProductCard.tsx').default;
 const product={...load('lib/sanji-demo.ts').SANJI_DEMO_PRODUCTS[0].product,id:crab,name:legacy,price:38900,original_price:100000,status:'active',stock:10,expected_ship_date:null};
 const props={product,images:[],reviews:{list:[],total:0,average:0},stats:{sold:0,buyers:0,rebuyers:0},others:[],influencerId:null,linkCode:null,kakaoUrl:'#',linkBase:''};
 const target=makeOption('실속형(수율70%내외) 8~9마리 3kg',38900);
 const high=makeOption('고급형(수율80%내외) 7마리 3kg',47900);
 const detail=(options,extra={})=>renderToStaticMarkup(React.createElement(View,{...props,options,...extra}));
 const rendered=detail([target,high]);
 assert.match(rendered,/<h1 class="sp-title">연지홍게<\/h1>/);
 assert.match(rendered,/class="now">38,900원.*class="sp-price-basis">실속형\(수율70%내외\) 8~9마리 3kg 기준/);
 assert.match(rendered,/47,900원/);
 assert.doesNotMatch(rendered,/프리미엄급 다리수율|산지에서 바로 발송|100,000원/);
 assert.equal((rendered.match(/출고 일정 확인 중/g)||[]).length,2);
 assert.equal((detail([target],{product:{...product,expected_ship_date:'2099-01-02'}}).match(/2099.01.02 출고 예정/g)||[]).length,2);
 assert.match(detail([high]),/옵션별 가격 확인/);
 assert.doesNotMatch(detail([high]),/class="now">38,900원/);
 const card=renderToStaticMarkup(React.createElement(Card,{product:{...product,name:'연지홍게',price_basis:target.name},href:'/p/'+crab,now:Date.now()}));
 assert.match(card,/38,900원.*실속형\(수율70%내외\) 8~9마리 3kg 기준/);
 assert.doesNotMatch(card,/100,000원/);
});

test('metadata keeps the canonical URL and uses the corrected title for search and sharing',async()=>{
 const id=crab;
 const saved={id,name:legacy,brand:'산지픽',is_visible:true,status:'active'};
 const page=load('app/sanji/p/[id]/page.tsx',{
  '@/lib/sanji-data':{getSanjiProduct:async()=>saved},
  'next/navigation':{notFound(){throw Error('Not found');}},
  '@/lib/sanji-link':{},
 });
 const meta=await page.generateMetadata({params:Promise.resolve({id}),searchParams:Promise.resolve({})});
 assert.match(meta.title.absolute,/^연지홍게/);
 assert.equal(meta.openGraph.title,meta.title.absolute);
 assert.doesNotMatch(meta.description,/80%이상/);
 assert.equal(meta.alternates.canonical,'https://sanjipick.blendpunch.com/p/'+id);
 assert.equal(saved.name,legacy);
});
