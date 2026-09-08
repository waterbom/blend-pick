const fs=require('node:fs');const fsp=fs.promises;const path=require('node:path');const zlib=require('node:zlib');
const {createAggregator}=require('./aggregate.cjs');
const DEFAULT_LOG='/var/log/nginx';const DEFAULT_STATE='/var/lib/blendpick-monitor';
function rangeStart(days,now){const date=new Date(+now+9*3600000).toISOString().slice(0,10);return new Date(Date.parse(date+'T00:00:00+09:00')-(days-1)*86400000);}
async function atomic(file,value){const temp=file+'.'+process.pid+'.tmp';await fsp.writeFile(temp,JSON.stringify(value),{mode:0o640});await fsp.rename(temp,file);}
async function collect({logDir=DEFAULT_LOG,stateDir=DEFAULT_STATE,now=new Date()}={}){
 const marker=JSON.parse(await fsp.readFile(path.join(stateDir,'capture.json'),'utf8'));
 if(!Number.isFinite(Date.parse(marker.startedAt)))throw Error('Capture start missing');
 const start=new Date(marker.startedAt);const scans=[1,7,30].map(days=>({days,aggregator:createAggregator({from:rangeStart(days,now).toISOString(),to:now.toISOString()})}));
 const paths=(await fsp.readdir(logDir)).filter(n=>/^blendpick-traffic\.jsonl(?:-\d{8})?(?:\.gz)?$/.test(n)).sort();
 if(!paths.includes('blendpick-traffic.jsonl'))throw Error('Current traffic log missing');
 const seen=new Set();let trailing=0,fileCount=0,lastEventAt=null;
 for(const name of paths){const file=path.join(logDir,name),handle=await fsp.open(file,'r');try{
   const stat=await handle.stat();if(!stat.isFile())throw Error('Invalid traffic log');const key=stat.dev+':'+stat.ino;if(seen.has(key))continue;seen.add(key);fileCount++;
   if(!stat.size)continue;
   const source=handle.createReadStream({start:0,end:stat.size-1,autoClose:false});
   const stream=name.endsWith('.gz')?source.pipe(zlib.createGunzip()):source;
   if(stream!==source)source.on('error',e=>stream.destroy(e));let pending='';
   for await(const chunk of stream){pending+=chunk.toString('utf8');let cut;while((cut=pending.indexOf('\n'))!==-1){const line=pending.slice(0,cut);pending=pending.slice(cut+1);for(const scan of scans)scan.aggregator.push(line);try{const r=JSON.parse(line),date=Date.parse(r.time);if(['blendpick','sanjipick'].includes(r.site)&&Number.isFinite(date)&&date<=+now&&(!lastEventAt||date>Date.parse(lastEventAt)))lastEventAt=new Date(date).toISOString();}catch{}}
     if(pending.length>16384)throw Error('Traffic log line exceeds expected format');
   }if(pending.trim())trailing++;
 }finally{await handle.close();}}
 const report={version:1,mode:'observed',generatedAt:now.toISOString(),captureStartedAt:start.toISOString(),lastEventAt,fileCount,trailingLines:trailing,ranges:scans.map(({days,aggregator})=>{const r=aggregator.result();return {days,...r,effectiveFrom:new Date(Math.max(Date.parse(r.from),+start)).toISOString()};})};
 if(report.ranges.some(r=>r.quality.invalid||r.quality.unknownSite))throw Error('Invalid traffic log entries; previous summary preserved');
 await atomic(path.join(stateDir,'traffic-summary.json'),report);await fsp.rm(path.join(stateDir,'traffic-error.json'),{force:true});
 console.log(JSON.stringify({event:'traffic_collected',generatedAt:report.generatedAt,captureStartedAt:report.captureStartedAt,sites:report.ranges[0].sites.map(s=>({site:s.key,requests:s.total.requests,sentBytes:s.total.sentBytes})),files:fileCount}));return report;
}
module.exports={collect,rangeStart};
if(require.main===module)collect().catch(async()=>{try{await atomic(path.join(DEFAULT_STATE,'traffic-error.json'),{failedAt:new Date().toISOString(),code:'collection_failed'});}catch{}console.error('Traffic collection failed; previous successful summary retained.');process.exitCode=1;});
