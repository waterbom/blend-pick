const SITES=['blendpick','sanjipick'];
const ROUTES=['home','products','login','assets','api','admin','other'];
const CLIENTS=['other','bot','monitor'];
const number=v=>(typeof v==='number'||typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v))&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):NaN;
const timestamp=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v)?Date.parse(v):NaN;
function fresh(){return {requests:0,sentBytes:0,receivedBytes:0,htmlDocuments:0,botRequests:0,monitorRequests:0,otherRequests:0,errors4xx:0,errors5xx:0,slowRequests:0,totalSeconds:0};}
function add(m,r){m.requests++;m.sentBytes+=r.bytes;m.receivedBytes+=r.request_bytes;m[r.client==='bot'?'botRequests':r.client==='monitor'?'monitorRequests':'otherRequests']++;if(r.status>=400&&r.status<500)m.errors4xx++;if(r.status>=500)m.errors5xx++;if(r.seconds>=3)m.slowRequests++;m.totalSeconds+=r.seconds;if(r.client==='other'&&r.prefetch==='0'&&r.method==='GET'&&r.status===200&&r.content_type.toLowerCase().startsWith('text/html')&&['home','products','login','other'].includes(r.route))m.htmlDocuments++;}
function finish(m){return {...m,averageMs:m.requests?Math.round(m.totalSeconds/m.requests*1000):null,error5xxPercent:m.requests?Math.round(m.errors5xx/m.requests*10000)/100:null};}
function createAggregator({from,to,mode='observed'}){
  const start=timestamp(from),end=timestamp(to);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>31*86400000)throw Error('기간은 시간대가 있는 ISO 시각, 최대 31일, 시작 < 종료여야 합니다.');
  const sites=Object.fromEntries(SITES.map(s=>[s,{key:s,total:fresh(),hours:new Map(),routes:Object.fromEntries(ROUTES.map(r=>[r,fresh()]))}]));
  const quality={lines:0,invalid:0,outsideWindow:0,unknownSite:0,accepted:0};
  return {
    push(line){if(!line.trim())return;quality.lines++;let r;try{r=JSON.parse(line)}catch{quality.invalid++;return;}
      if(!r||typeof r!=='object'||r.schema!==1){quality.invalid++;return;}
      if(!SITES.includes(r.site)){quality.unknownSite++;return;}
      const t=timestamp(r.time),status=number(r.status),bytes=number(r.bytes),received=number(r.request_bytes),seconds=number(r.seconds);
      if(!Number.isFinite(t)||!Number.isInteger(status)||status<100||status>599||!Number.isSafeInteger(bytes)||!Number.isSafeInteger(received)||!Number.isFinite(seconds)||!CLIENTS.includes(r.client)||!ROUTES.includes(r.route)||!['0','1'].includes(r.prefetch)||typeof r.content_type!=='string'||typeof r.method!=='string'){quality.invalid++;return;}
      if(t<start||t>=end){quality.outsideWindow++;return;}
      r={...r,status,bytes,request_bytes:received,seconds};quality.accepted++;
      const s=sites[r.site],hour=new Date(Math.floor(t/3600000)*3600000).toISOString();
      if(!s.hours.has(hour))s.hours.set(hour,fresh());add(s.total,r);add(s.hours.get(hour),r);add(s.routes[r.route],r);
    },
    result(){return {version:1,mode,from,to,generatedAt:new Date().toISOString(),quality:{...quality},coverage:'unverified',sites:SITES.map(key=>({key,total:finish(sites[key].total),hours:[...sites[key].hours].sort(([a],[b])=>a.localeCompare(b)).map(([hour,m])=>({hour,...finish(m)})),routes:Object.entries(sites[key].routes).filter(([,m])=>m.requests).map(([route,m])=>({route,...finish(m)}))}))};}
  };
}
function exampleTraffic(){const a=createAggregator({from:'2026-09-08T00:00:00+09:00',to:'2026-09-09T00:00:00+09:00',mode:'example'});for(const [s,site]of SITES.entries())for(let h=8;h<15;h++)for(let i=0;i<(h-6)*(s?19:31);i++)a.push(JSON.stringify({schema:1,time:`2026-09-08T${String(h).padStart(2,'0')}:15:00+09:00`,site,client:i%23===0?'monitor':i%11===0?'bot':'other',route:i%3===0?'products':i%3===1?'assets':'home',method:'GET',status:i%59===0?'503':'200',bytes:String(i%3===1?240000:31000),request_bytes:'700',seconds:i%59===0?'3.5':'0.24',content_type:i%3===1?'image/webp':'text/html',prefetch:'0'}));return a.result();}
module.exports={createAggregator,exampleTraffic};
