const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./support/load.cjs');

const css = new Proxy({}, { get: (_,key) => typeof key === 'string' ? key : undefined });
const Link = ({children,href,...props}) => React.createElement('a',{href,...props},children);
function renderSupplier() {
  const Page = load('components/blend/SupplierPage.tsx',{
    'next/link': {__esModule:true,default:Link},
    './SupplierPage.module.css':{__esModule:true,default:css},
  }).default;
  return renderToStaticMarkup(React.createElement(Page));
}

test('supplier landing has a readable conversion-focused hierarchy and connected CTA anchors',()=>{
  const html=renderSupplier();
  assert.match(html,/<h1[^>]+id="supplier-title"/);
  assert.match(html,/좋은 상품/);
  for(const part of ['WHY BLEND PICK','WHAT WE CAN BUILD','HOW WE WORK','BUILT FOR THE NEXT CAMPAIGN','FREQUENT QUESTIONS','START A PARTNERSHIP']) assert.ok(html.includes(part),part);
  assert.match(html,/href="#proposal"/);
  assert.match(html,/id="proposal"/);
  assert.match(html,/href="#process"/);
  assert.match(html,/id="process"/);
  assert.match(html,/class="faqItem"/);
});

test('supplier proof differentiates group-wide numbers from Blend Pick platform claims',()=>{
 const html=renderSupplier();
 assert.match(html,/300\+/);
 assert.match(html,/500\+/);
 assert.match(html,/50억\+/);
 assert.match(html,/그룹 실적/);
 assert.match(html,/블랜드픽 단독 실적은 아닙니다/);
 assert.match(html,/https:\/\/blendpunch.com\//);
 assert.match(html,/실제 매출 수치가 아닙니다/);
 assert.doesNotMatch(html,/\+320%/);
});

test('categories use only existing first-party assets and responsive CSS contains narrow screen rules',()=>{
 const src=fs.readFileSync('components/blend/SupplierPage.tsx','utf8');
 const urls=[...src.matchAll(/(?:src|image)\s*[:=]\s*["'](\/[^"'\n]+\.(?:png|jpg|jpeg|webp|svg))["']/g)].map(m=>m[1]);
 assert.ok(urls.length>=11,'expect purpose-built product, category and hero visuals');
 assert.equal(new Set(urls).size,7,'every category and hero slot uses the dedicated asset set');
 for(const image of urls) {
   assert.ok(image.startsWith('/suppliers/'),'must never borrow product photos or runtime upload URLs: '+image);
   assert.ok(fs.existsSync('public'+image),'missing bundled asset: '+image);
   const data=fs.readFileSync('public'+image);
   assert.ok(data.length>1000,'unexpected empty asset: '+image);
   if(image.endsWith('.webp')) {
     assert.equal(data.toString('ascii',0,4),'RIFF','invalid WEBP header: '+image);
     assert.equal(data.toString('ascii',8,12),'WEBP','invalid WEBP content: '+image);
   } else {
     assert.match(data.toString('utf8').slice(0,160),/<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
   }
 }
 const css=fs.readFileSync('components/blend/SupplierPage.module.css','utf8');
 for(const cls of ['.heroWrap','.trustStats','.visualCategoryGrid','.journey','.strategyGrid','.faqItem','.proposalShell']) assert.ok(css.includes(cls),cls);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('supplier contact retains existing inquiry endpoint, validation and consent fields',()=>{
 const html=renderSupplier();
 for(const name of ['company','name','contact','proposalCategory','productName','message','consent']) assert.match(html,new RegExp('name="'+name+'"'));
 assert.match(html,/privacy/);
 const src=fs.readFileSync('components/blend/SupplierPage.tsx','utf8');
 assert.ok(src.includes('validateSupplierProposal'));
 assert.ok(src.includes('fetch("/api/inquiry"'));
 assert.ok(src.includes('role="alert"'));
 assert.ok(src.includes('setEmailPending(result.emailSent === false)'));
});
