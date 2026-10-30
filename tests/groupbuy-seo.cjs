const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./support/load.cjs');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

test('distinct group-buy pages have unique titles and canonical URLs',()=>{
 const blend=load('app/group-buy/page.tsx',{'@/components/Header':()=>null});
 const sanji=load('app/sanji/group-buy/page.tsx');
 assert.match(blend.metadata.title,/공동구매란/);
 assert.match(sanji.metadata.title,/농산물·수산물 공동구매/);
 assert.equal(blend.metadata.alternates.canonical,'https://shop.blendpunch.com/group-buy');
 assert.equal(sanji.metadata.alternates.canonical,'https://sanjipick.blendpunch.com/group-buy');
 assert.notEqual(blend.metadata.description,sanji.metadata.description);
 const b=renderToStaticMarkup(React.createElement(blend.default));
 const s=renderToStaticMarkup(React.createElement(sanji.default));
 assert.match(b,/공동구매/);assert.match(b,/products/);assert.match(b,/application\/ld\+json/);
 assert.match(s,/수산물 공동구매/);assert.match(s,/category=produce/);assert.match(s,/category=seafood/);
});
test('sitemaps, links and host rewriting include distinct guides',()=>{
 const fs=require('node:fs');
 const bp=fs.readFileSync('app/sitemap.ts','utf8'),sj=fs.readFileSync('app/sanji/sitemap.ts','utf8');
 const proxy=fs.readFileSync('proxy.ts','utf8'),footer=fs.readFileSync('components/Footer.tsx','utf8');
 assert.match(bp,/\/group-buy/);assert.match(sj,/\/group-buy/);
 assert.match(proxy,/SANJI_OWN_PATHS[^\n]*group-buy/);
 assert.match(footer,/href="\/group-buy"/);
});
