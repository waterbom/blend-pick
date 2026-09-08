const fs = require('node:fs');
const path = require('node:path');
const { runMonitor } = require('./monitor/engine.cjs');
const { html, markdown } = require('./monitor/report.cjs');
async function main() {
  const args = process.argv.slice(2); let out = 'monitor-output', example = false, trafficFile;
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--example') example=true;
    else if(args[i]==='--traffic-summary' && args[i+1] && !args[i+1].startsWith('--')) trafficFile=args[++i];
    else if(args[i]==='--output-dir' && args[i+1] && !args[i+1].startsWith('--')) out=args[++i];
    else throw Error('사용법: node scripts/check-storefront.cjs [--example] [--output-dir DIRECTORY] [--traffic-summary JSON]');
  }
  const report = example ? require('./monitor/example.cjs').exampleReport() : await runMonitor();
  if(trafficFile){ report.traffic=JSON.parse(fs.readFileSync(trafficFile,'utf8')); if(report.traffic.version!==1 || !Array.isArray(report.traffic.sites) || report.mode!==report.traffic.mode) throw Error('트래픽 형식 또는 예시/실측 모드가 다릅니다.'); }
  const dir=path.resolve(out);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(dir,'summary.md'),markdown(report));
  fs.writeFileSync(path.join(dir,'report.html'),html(report));
  if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown(report));
  console.log(markdown(report));
  if(!example && report.counts.fail) process.exitCode=1;
}
if(require.main===module) main().catch(()=>{console.error('점검을 완료하지 못했습니다. 실행 환경과 출력 경로를 확인하세요.');process.exitCode=2;});
