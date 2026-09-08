// 기존 로그·도메인 설정을 보존하고 별도 집계만 설치한다. 루트 권한으로 배포 과정에서 실행.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {inspectConfig}=require('./traffic/nginx-config.cjs');
const run=(command,args=[])=>cp.execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const CONF='/etc/nginx/conf.d/blendpick-traffic.conf',STATE='/var/lib/blendpick-monitor',LIB='/usr/local/lib/blendpick-monitor';
function write(file,value,mode=0o644){fs.writeFileSync(file,value,{mode});fs.chmodSync(file,mode);}
function systemdQuote(value){if(/[\n\r\0]/.test(value))throw Error('Invalid service path');return '"'+value.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/%/g,'%%')+'"';}
async function install(){if(process.getuid?.()!==0)throw Error('Root required');
 const inspection=inspectConfig(run('nginx',['-T']));console.log('Traffic nginx inspection: '+JSON.stringify(inspection));
 const user=run('systemctl',['show','blend-pick','--property=User','--value'])||'root';const group=run('id',['-gn',user]);const uid=Number(run('id',['-u',user])),gid=Number(run('id',['-g',user]));
 if(!/^[a-zA-Z0-9_-]+$/.test(user)||!/^[a-zA-Z0-9_-]+$/.test(group))throw Error('Unsupported service identity');
 fs.mkdirSync(STATE,{recursive:true,mode:0o750});fs.chownSync(STATE,uid,gid);fs.chmodSync(STATE,0o750);
 fs.mkdirSync(path.join(LIB,'traffic'),{recursive:true,mode:0o755});
 for(const name of ['aggregate.cjs','live.cjs'])write(path.join(LIB,'traffic',name),fs.readFileSync(path.join(__dirname,'traffic',name),'utf8'));
 const template=fs.readFileSync(path.join(__dirname,'../ops/nginx/traffic-log.conf.example'),'utf8');
 const conf='# Managed by blendpick traffic monitor\n'+template+'\naccess_log /var/log/nginx/blendpick-traffic.jsonl bp_traffic buffer=32k flush=5s if=$bp_traffic_enabled;\n';
 const old=fs.existsSync(CONF)?fs.readFileSync(CONF,'utf8'):null;if(old&&!old.startsWith('# Managed by blendpick traffic monitor'))throw Error('Unmanaged traffic configuration exists');
 const rollback=()=>{if(old===null)fs.rmSync(CONF,{force:true});else write(CONF,old);};
 const logfile='/var/log/nginx/blendpick-traffic.jsonl';const fd=fs.openSync(logfile,'a',0o640);fs.closeSync(fd);fs.chownSync(logfile,0,gid);fs.chmodSync(logfile,0o640);
 if(old!==conf){if(old!==null)write(CONF+'.previous',old,0o600);write(CONF,conf);try{run('nginx',['-t']);run('systemctl',['reload','nginx']);}catch{rollback();try{run('nginx',['-t']);run('systemctl',['reload','nginx']);}catch{}throw Error('Nginx traffic configuration rejected and restored');}}
 const marker=path.join(STATE,'capture.json');if(!fs.existsSync(marker)){write(marker,JSON.stringify({startedAt:new Date().toISOString()}),0o640);fs.chownSync(marker,uid,gid);}
 write('/etc/logrotate.d/blendpick-traffic',`/var/log/nginx/blendpick-traffic.jsonl {\n  daily\n  rotate 32\n  dateext\n  dateformat -%Y%m%d\n  compress\n  delaycompress\n  missingok\n  notifempty\n  create 0640 root ${group}\n  sharedscripts\n  postrotate\n    /usr/sbin/nginx -s reopen\n  endscript\n}\n`);
 write('/etc/systemd/system/blendpick-traffic.service',`[Unit]\nDescription=Aggregate Blendpick storefront traffic\nAfter=nginx.service\n[Service]\nType=oneshot\nUser=${user}\nGroup=${group}\nExecStart=${systemdQuote(process.execPath)} ${systemdQuote(path.join(LIB,'traffic/live.cjs'))}\nTimeoutStartSec=240\nUMask=0027\nNoNewPrivileges=true\nPrivateTmp=true\nProtectSystem=strict\nReadWritePaths=${STATE}\n`);
 write('/etc/systemd/system/blendpick-traffic.timer','[Unit]\nDescription=Refresh storefront traffic every 30 minutes\n[Timer]\nOnCalendar=*-*-* *:00,30:00\nPersistent=true\nRandomizedDelaySec=15\nUnit=blendpick-traffic.service\n[Install]\nWantedBy=timers.target\n');
 run('systemctl',['daemon-reload']);run('systemctl',['enable','--now','blendpick-traffic.timer']);
 // 실측 경로 검증용 공개 GET. 봇 분류로 남겨 고객 HTML 조회로 계산하지 않는다.
 for(const host of ['shop.blendpunch.com','sanjipick.blendpunch.com'])run('curl',['--silent','--show-error','--output','/dev/null','--max-time','15','--resolve',host+':80:127.0.0.1','--user-agent','Blendpick-ReadOnly-Monitor/TrafficSetup','http://'+host+'/']);
 await new Promise(resolve=>setTimeout(resolve,6500));run('systemctl',['start','blendpick-traffic.service']);
 const report=JSON.parse(fs.readFileSync(path.join(STATE,'traffic-summary.json'),'utf8'));
 if(!report.ranges[0].sites.every(s=>s.total.requests>0))throw Error('Both storefronts must produce traffic records');
 run('systemctl',['is-active','--quiet','blendpick-traffic.timer']);
 // 실제 웹 서비스 계정으로 요약 파일 접근을 검증한다. 인증 토큰을 만들지 않는다.
 run('runuser',['-u',user,'--',process.execPath,'-e',`const fs=require('node:fs');const r=JSON.parse(fs.readFileSync('/var/lib/blendpick-monitor/traffic-summary.json','utf8'));if(r.mode!=='observed'||!r.ranges.length)process.exit(1);`]);
 for(const host of ['shop.blendpunch.com','sanjipick.blendpunch.com']){
  const code=run('curl',['--silent','--show-error','--output','/dev/null','--write-out','%{http_code}','--max-time','20','--user-agent','Blendpick-ReadOnly-Monitor/TrafficSetup','https://'+host+'/api/admin/traffic']);
  if(code!=='401')throw Error('Traffic API authentication check failed for '+host+' (HTTP '+code+')');
 }
 console.log('Traffic pipeline active: '+JSON.stringify({user,timer:true,captureStartedAt:report.captureStartedAt,generatedAt:report.generatedAt,sites:report.ranges[0].sites.map(s=>({site:s.key,requests:s.total.requests,sentBytes:s.total.sentBytes}))}));
}
module.exports={systemdQuote};
if(require.main===module)install().catch(e=>{console.error('Traffic installation failed: '+e.message.split('\n')[0]);process.exitCode=1;});
