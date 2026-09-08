// 지정한 로컬 JSONL 로그만 읽는다. 서버 접속·설정 변경·전송은 하지 않는다.
const fs=require('node:fs'),readline=require('node:readline'),path=require('node:path');
const {createAggregator,exampleTraffic}=require('./traffic/aggregate.cjs');
async function main(){const args=process.argv.slice(2),input=[];let from,to,output,example=false;
 for(let i=0;i<args.length;i++){const k=args[i];if(k==='--example'){example=true;continue;}if(!['--input','--from','--to','--output'].includes(k)||!args[i+1]||args[i+1].startsWith('--'))throw Error('arguments');const v=args[++i];if(k==='--input')input.push(v);else if(k==='--from')from=v;else if(k==='--to')to=v;else output=v;}
 if(!output||example&&(input.length||from||to)||!example&&(!input.length||!from||!to))throw Error('arguments');
 let report;if(example)report=exampleTraffic();else{const a=createAggregator({from,to}),seen=new Set();for(const file of input){const stat=fs.statSync(file),id=stat.dev+':'+stat.ino;if(!stat.isFile()||seen.has(id))throw Error('invalid/duplicate file');seen.add(id);const stream=fs.createReadStream(file,{encoding:'utf8'});const lines=readline.createInterface({input:stream,crlfDelay:Infinity});for await(const line of lines)a.push(line);}report=a.result();}
 const out=path.resolve(output);if(input.some(f=>fs.realpathSync(f)===out))throw Error('output overwrites input');fs.mkdirSync(path.dirname(out),{recursive:true});const temp=out+'.'+process.pid+'.tmp';fs.writeFileSync(temp,JSON.stringify(report,null,2),{mode:0o600,flag:'wx'});fs.renameSync(temp,out);console.log(`집계 ${report.quality.accepted}건 · 잘못된 행 ${report.quality.invalid}건 · 로그 완전성 미확인`);if(report.quality.invalid||report.quality.unknownSite)process.exitCode=1;
}
if(require.main===module)main().catch(()=>{console.error('집계 미완료. --input JSONL --from ISO --to ISO --output JSON 또는 --example --output JSON을 확인하세요. 원본 로그는 출력하지 않습니다.');process.exitCode=2;});
