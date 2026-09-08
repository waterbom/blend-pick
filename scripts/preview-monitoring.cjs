// 관리자와 같은 컴포넌트·빌드 CSS로, 외부 연결 없는 설명용 미리보기를 생성한다.
const fs=require('node:fs'),path=require('node:path');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {load}=require('../tests/support/load.cjs');
const {analyticsRange}=load('lib/visit-analytics/rules.ts');
const View=load('components/admin/MonitoringOverview.tsx').default;
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const cssFiles=files(path.join(__dirname,'../.next/static')).filter(f=>f.endsWith('.css'));
if(!cssFiles.length)throw Error('먼저 npm run build를 실행하세요.');
const css=cssFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const now=new Date('2026-09-08T05:00:00Z');
const names={blendpick:'블랜드픽',sanjipick:'산지픽'};
const screens={};
for(const site of Object.keys(names))for(const days of [1,7,30])for(const state of ['active','disabled','error']){
 const {from,to}=analyticsRange(days,now),factor=site==='blendpick'?3:2;
 const daily=Array.from({length:days},(_,i)=>({day:new Date(+from+i*86400000+9*3600000).toISOString().slice(0,10),visitors:(i%4+5)*factor,sessions:(i%4+7)*factor,pageviews:(i%4+7)*factor*3}));
 const views=daily.reduce((n,d)=>n+d.pageviews,0),sessions=daily.reduce((n,d)=>n+d.sessions,0);
 const summary={site,days,state,from:from.toISOString(),to:to.toISOString(),lastEventAt:state==='active'?new Date(+now-300000).toISOString():null,totals:state==='active'?{visitors:days===1?daily[0].visitors:Math.round(daily.reduce((n,d)=>n+d.visitors,0)*.7),sessions,pageviews:views}:null,pages:state==='active'?[{page:'product',views:views/3},{page:'home',views:views/3},{page:'cart',views:views/3}]:[],daily:state==='active'?daily:[]};
 screens[`${site}:${days}:${state}`]=renderToStaticMarkup(React.createElement(View,{siteName:names[site],summary,example:true}));
}
const json=JSON.stringify(screens).replace(/</g,'\\u003c');
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>방문·트래픽·점검 · 빌드 검토본</title><style>${css}\nbody{background:#f5f5f4;font-family:system-ui,-apple-system,sans-serif}.preview-tools{padding:12px 20px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;background:#163d31;color:#fff;font-size:12px}.preview-tools select{background:white;color:#163d31;border-radius:6px;padding:7px 10px}.preview-tools label{display:flex;align-items:center;gap:8px}.preview-tools b{margin-right:auto}</style></head><body><div class="preview-tools"><b>검토용 미리보기 · 운영 수집 미가동</b><label>사이트<select id="site"><option value="blendpick">블랜드픽</option><option value="sanjipick">산지픽</option></select></label><label>화면 상태<select id="state"><option value="active">수집 후 예시</option><option value="disabled">수집 대기</option><option value="error">조회 실패</option></select></label></div><div id="screen">${screens['blendpick:7:active']}</div><script>const screens=${json};let days=7;const site=document.getElementById('site'),state=document.getElementById('state'),screen=document.getElementById('screen');function draw(){screen.innerHTML=screens[site.value+':'+days+':'+state.value]}site.addEventListener('change',draw);state.addEventListener('change',draw);document.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;const href=a.getAttribute('href');if(href&&href.startsWith('?days=')){e.preventDefault();days=Number(href.split('=')[1]);draw()}});</script></body></html>`;
const out=process.argv[2];if(!out)throw Error('출력 HTML 경로를 지정하세요.');fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,html);console.log('미리보기 생성 완료');
