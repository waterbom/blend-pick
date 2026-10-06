const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./support/load.cjs');
let pathname='/';
const Frame=load('components/StorefrontFrame.tsx',{'next/navigation':{usePathname:()=>pathname}}).default;
const render=site=>renderToStaticMarkup(React.createElement(Frame,{site},React.createElement('main',null,'content')));
for(const path of ['/','/sanji','/p/example','/products/example/checkout','/cart','/cart/checkout','/orders/lookup','/sanji/mypage','/login']){
 test(`Sanji customer frame covers ${path}`,()=>{pathname=path;assert.match(render('sanjipick'),/class="sanji-mobile-shell"/);assert.match(render('sanjipick'),/<main>content<\/main>/);});
}
for(const path of ['/admin','/admin/orders','/influencer','/partners/products','/sanji/admin/orders']){
 test(`workspace remains unframed at ${path}`,()=>{pathname=path;assert.equal(render('sanjipick'),'<main>content</main>');});
}
test('Blendpick stays unframed and navigating away from admin restores customer frame',()=>{
 pathname='/';assert.equal(render('blendpick'),'<main>content</main>');
 pathname='/admin/orders';assert.equal(render('sanjipick'),'<main>content</main>');
 pathname='/cart';assert.match(render('sanjipick'),/sanji-mobile-shell/);
});
