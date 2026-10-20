const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {systemdQuote}=require('./install-traffic-monitor.cjs');
const run=(cmd,args)=>cp.execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function retentionUnits({user,cwd,node}){
  if(!/^[a-zA-Z0-9_-]+$/.test(user))throw Error('INVALID_SERVICE_USER');
  if(!path.isAbsolute(cwd)||/[\x00-\x1f\x7f]/.test(cwd)||cwd.trim()!==cwd)throw Error('INVALID_WORKING_DIRECTORY');
  const script=path.join(cwd,'scripts/retain-visit-analytics.cjs');
  // WorkingDirectory is a single path, not an ExecStart argument: quotes become
  // literal path characters and make systemd reject an otherwise absolute path.
  const directory=cwd.replace(/%/g,'%%');
  return {
    service:`[Unit]\nDescription=Remove visit analytics older than 90 days\nAfter=network-online.target\n[Service]\nType=oneshot\nUser=${user}\nWorkingDirectory=${directory}\nExecStart=${systemdQuote(node)} ${systemdQuote(script)}\nTimeoutStartSec=120\nNoNewPrivileges=true\nPrivateTmp=true\nProtectSystem=strict\n`,
    timer:'[Unit]\nDescription=Daily visit analytics retention\n[Timer]\nOnCalendar=*-*-* 03:30:00 Asia/Seoul\nPersistent=true\nRandomizedDelaySec=60\n[Install]\nWantedBy=timers.target\n'
  };
}
function install(){
  if(process.getuid?.()!==0)throw Error('ROOT_REQUIRED');
  const user=run('systemctl',['show','blend-pick','--property=User','--value'])||'root';
  const units=retentionUnits({user,cwd:process.cwd(),node:process.execPath});
  const serviceFile='/etc/systemd/system/blendpick-visit-retention.service',timerFile='/etc/systemd/system/blendpick-visit-retention.timer';
  fs.writeFileSync(serviceFile,units.service,{mode:0o644});
  fs.writeFileSync(timerFile,units.timer,{mode:0o644});
  run('systemd-analyze',['verify',serviceFile,timerFile]);
  run('systemctl',['daemon-reload']);run('systemctl',['enable','--now','blendpick-visit-retention.timer']);run('systemctl',['start','blendpick-visit-retention.service']);run('systemctl',['is-active','--quiet','blendpick-visit-retention.timer']);
  console.log('Visit analytics retention: daily timer active.');
}
module.exports={retentionUnits};
if(require.main===module)install();
