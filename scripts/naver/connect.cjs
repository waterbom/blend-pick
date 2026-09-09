'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');

function credentials(env) {
  const id=env.NAVER_CLIENT_ID, secret=env.NAVER_CLIENT_SECRET;
  if(!id || !secret) throw Error('NAVER_SECRETS_MISSING');
  if(!/^[A-Za-z0-9_-]+$/.test(id) || !/^[A-Za-z0-9_-]+$/.test(secret)) throw Error('NAVER_SECRETS_INVALID_FORMAT');
  return {id,secret};
}
function requestBody(now=new Date()) {
  // Complete days only, using Korean calendar dates; this is a connectivity probe, not a trend score.
  const kst=new Date(now.getTime()+9*3600000);
  const end=new Date(Date.UTC(kst.getUTCFullYear(),kst.getUTCMonth(),kst.getUTCDate())-86400000);
  return {startDate:new Date(end.getTime()-6*86400000).toISOString().slice(0,10),endDate:end.toISOString().slice(0,10),timeUnit:'date',keywordGroups:[{groupName:'공동구매',keywords:['공동구매','공구']}]};
}
async function collect(env, fetcher=fetch, now=new Date()) {
  const keys=credentials(env), body=requestBody(now);
  let response;
  try {
    response=await fetcher('https://openapi.naver.com/v1/datalab/search',{
      method:'POST',headers:{'Content-Type':'application/json','X-Naver-Client-Id':keys.id,'X-Naver-Client-Secret':keys.secret},
      body:JSON.stringify(body),signal:AbortSignal.timeout(20000),redirect:'error',
    });
  } catch { throw Error('NAVER_CONNECTION_FAILED'); }
  if(response.status!==200) throw Error(`NAVER_HTTP_${Number(response.status)}`);
  let data;
  try { data=await response.json(); } catch { throw Error('NAVER_RESPONSE_INVALID'); }
  const points=data?.results?.[0]?.data;
  if(data.startDate!==body.startDate || data.endDate!==body.endDate || data.timeUnit!=='date' || !Array.isArray(points) || !points.every(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.period) && Number.isFinite(p.ratio) && p.ratio>=0 && p.ratio<=100)) throw Error('NAVER_RESPONSE_INVALID');
  // Allow-list persisted fields. Never persist response headers, credentials, or arbitrary API messages.
  return {checkedAt:now.toISOString(),source:'naver-datalab-search',purpose:'connection-check',startDate:body.startDate,endDate:body.endDate,timeUnit:'date',keywordGroups:body.keywordGroups,points:points.map(p=>({period:p.period,ratio:p.ratio}))};
}
function replaceEnv(text, env) {
  const {id,secret}=credentials(env);
  const kept=text.split(/\r?\n/).filter(line=>!/^\s*(?:export\s+)?NAVER_CLIENT_(?:ID|SECRET)\s*=/.test(line));
  while(kept.at(-1)==='') kept.pop();
  return [...kept,`NAVER_CLIENT_ID=${id}`,`NAVER_CLIENT_SECRET=${secret}`,''].join('\n');
}
async function atomicWrite(file,text,mode=0o600) {
  const temp=`${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temp,text,{mode,flag:'wx'}); await fs.rename(temp,file); }
  finally { await fs.rm(temp,{force:true}); }
}
async function connect({dir=process.cwd(),env=process.env,fetcher=fetch,now=new Date()}={}) {
  const snapshot=await collect(env,fetcher,now); // A failed probe must leave working server credentials untouched.
  const envPath=path.join(dir,'.env.local');
  const old=await fs.readFile(envPath,'utf8');
  await atomicWrite(envPath,replaceEnv(old,env));
  const output=path.join(dir,'.naver-runtime');
  await fs.mkdir(output,{recursive:true,mode:0o700});
  await atomicWrite(path.join(output,'connection.json'),JSON.stringify(snapshot,null,2)+'\n');
  return {httpStatus:200,points:snapshot.points.length,startDate:snapshot.startDate,endDate:snapshot.endDate,credentialsSaved:true};
}
module.exports={credentials,requestBody,collect,replaceEnv,connect};
if(require.main===module) connect().then(result=>console.log('NAVER_CONNECTION_OK',JSON.stringify(result))).catch(error=>{
  const code=/^NAVER_[A-Z0-9_]+$/.test(error.message)?error.message:'NAVER_SETUP_FAILED';
  console.error(code);process.exitCode=1;
});
