const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./support/load.cjs');
const {PGlite}=require('@electric-sql/pglite');
const seo=load('lib/product-seo.ts');
const catalog=load('lib/catalog-seo.ts');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const id='00000000-0000-4000-8000-000000000001';
const product={id,name:'테스트 홍게 3kg',brand:'검증 농가',category:'산지픽 해산물',description:'<p>구성 3kg. 수령 후 냉동 보관해주세요.</p>',origin_country:'대한민국',price:12000,main_image:'/uploads/a.jpg',status:'active',stock:3,is_visible:true,sale_start_at:null,sale_end_at:null,shipping_type:'paid',shipping_cost:3000};
test('generated text uses provided fields without inventing origin or shipping promises',()=>{
 const a=seo.productSeo({...product,origin_country:null,description:'<img src="/a.jpg">',expected_ship_date:null},'sanjipick');
 assert.ok(a.missing.some(x=>x.includes('원산지')));assert.ok(a.missing.some(x=>x.includes('상세')));
 assert.doesNotMatch(a.description,/당일|국내산|대한민국|무료배송/);assert.match(a.shipping,/3,000/);
 assert.equal(a.schedule,'출고 일정 확인 중');
});
test('plain text removes active HTML and decodes Korean entities',()=>{
 assert.equal(seo.plainText('<script>bad()</script><style>bad</style><p>&#xD64D;&#44172;&nbsp;&amp; 게</p>'),'홍게 & 게');
 const text=seo.safeJsonLd({name:'</script><script>alert(1)</script>'});assert.ok(!text.includes('<'));assert.equal(JSON.parse(text).name,'</script><script>alert(1)</script>');
});
test('canonical excludes tracking and secret parameters, images are absolute',()=>{
 const m=seo.productMetadata(product,'sanjipick');
 assert.equal(m.alternates.canonical,'https://sanjipick.blendpunch.com/p/'+id);
 assert.equal(m.openGraph.images[0].url,'https://sanjipick.blendpunch.com/uploads/a.jpg');
 assert.ok(m.title.absolute.endsWith('산지픽'));assert.equal(m.robots,undefined);
});
test('secret, hidden, drafts and cross-site products never create product JSON-LD',()=>{
 for(const p of [{...product,is_visible:false},{...product,status:'draft'}])assert.equal(seo.productJsonLd(p,'sanjipick'),null);
 assert.equal(seo.productJsonLd(product,'sanjipick',[],true),null);
 assert.equal(seo.productJsonLd(product,'blendpick'),null);
 assert.equal(seo.productMetadata(product,'sanjipick',true).robots.index,false);
});
test('prices and option availability follow actual option values',()=>{
 const options=[{name:'소',extra_price:9000,stock:0,is_active:true},{name:'대',extra_price:17000,stock:4,is_active:true},{extra_price:1,stock:2,is_active:false}];
 const o=seo.productJsonLd(product,'sanjipick',options).offers;
 assert.equal(o.lowPrice,9000);assert.equal(o.highPrice,17000);assert.equal(o.offerCount,2);assert.match(o.availability,/InStock$/);
 assert.match(seo.productJsonLd(product,'sanjipick',options.map(o=>({...o,stock:0}))).offers.availability,/OutOfStock$/);
 assert.equal(seo.productJsonLd(product,'sanjipick',options.map(o=>({...o,is_active:false}))).offers,undefined);
});
test('end boundary, future opening and malformed dates never advertise in-stock',()=>{
 const now=Date.parse('2026-09-13T03:00:00Z');
 for(const patch of [{sale_end_at:new Date(now).toISOString()},{sale_start_at:new Date(now+1).toISOString()},{sale_start_at:'bad'},{stock:0},{status:'soldout'}]){
  assert.match(seo.productJsonLd({...product,...patch},'sanjipick',[],false,now).offers.availability,/OutOfStock$/);
 }
 assert.match(seo.productJsonLd({...product,stock:-1},'sanjipick',[],false,now).offers.availability,/InStock$/);
});
test('invalid image URLs are omitted safely',()=>{
 assert.deepEqual(seo.productMetadata({...product,main_image:'javascript:alert(1)'},'sanjipick').openGraph.images,[]);
 assert.deepEqual(seo.productMetadata({...product,main_image:'http://['},'sanjipick').openGraph.images,[]);
});
test('rendered customer summary exposes text and suppresses secret structured data',()=>{
 const Component=load('components/ProductSearchSummary.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Component,{product,site:'sanjipick'}));
 assert.match(html,/원산지/);assert.match(html,/대한민국/);assert.match(html,/application\/ld\+json/);
 const secret=renderToStaticMarkup(React.createElement(Component,{product,site:'sanjipick',secret:true}));
 assert.doesNotMatch(secret,/application\/ld\+json/);
});
test('category parameters reject arrays and prototype names',()=>{
 for(const value of ['__proto__','constructor','unknown',['seafood'],null])assert.equal(catalog.sanjiCollection(value),'all');
 assert.equal(catalog.sanjiCollection('seafood'),'seafood');
 assert.equal(catalog.collectionPath('농산물'),'/products?category='+encodeURIComponent('농산물'));
});
test('live sitemap SQL separates sites and includes all public products plus categories',async()=>{
 const db=new PGlite();
 try {
  await db.exec('CREATE TABLE products_shop(id text, category text,status text,is_visible boolean,updated_at timestamptz,created_at timestamptz)');
  await db.exec("INSERT INTO products_shop SELECT 'bp-'||g,'생활용품','active',true,NOW(),NOW() FROM generate_series(1,501) g");
  await db.exec("INSERT INTO products_shop VALUES ('sj','산지픽 해산물','active',true,NOW(),NOW()),('hidden','산지픽 농산물','active',false,NOW(),NOW()),('draft','생활용품','draft',true,NOW(),NOW())");
  const mocks={'@/lib/db-shop':{query:(sql,args)=>db.query(sql,args)}};
  const bp=await load('app/sitemap.ts',mocks).default();
  const sj=await load('app/sanji/sitemap.ts',mocks).default();
  assert.equal(bp.filter(x=>/products\/bp-/.test(x.url)).length,501);
  assert.ok(bp.some(x=>x.url.includes('?category=')));assert.ok(!bp.some(x=>x.url.includes('/sj')||x.url.includes('hidden')||x.url.includes('draft')));
  assert.ok(sj.some(x=>x.url.endsWith('/p/sj')));assert.ok(sj.some(x=>x.url.endsWith('category=seafood')));
  assert.ok(!sj.some(x=>x.url.includes('bp-')||x.url.includes('hidden')||x.url.includes('draft')));
 } finally {await db.close();}
});
test('DB failure cannot publish a misleading partial sitemap',async()=>{
 for(const file of ['app/sitemap.ts','app/sanji/sitemap.ts']){
 const fn=load(file,{'@/lib/db-shop':{query:async()=>{throw Error('isolated database failure')}}}).default;
 await assert.rejects(fn,/isolated database failure/);}
});
test('Sanjipick metadata keeps arbitrary searches excluded',async()=>{
 const page=load('app/sanji/products/page.tsx',{'@/lib/db-shop':{},'@/lib/db':{},'@/lib/sanji-link':{sanjiLinkBase:async()=>''}});
 for(const q of [{q:'홍게'},{category:'__proto__'},{category:['seafood']}]){
 assert.equal((await page.generateMetadata({searchParams:Promise.resolve(q)})).robots.index,false);}
 const m=await page.generateMetadata({searchParams:Promise.resolve({category:'seafood'})});
 assert.ok(m.alternates.canonical.endsWith('?category=seafood'));assert.match(m.title.absolute,/수산물/);
});
