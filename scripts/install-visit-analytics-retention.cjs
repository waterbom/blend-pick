const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {systemdQuote}=require('./install-traffic-monitor.cjs');
const run=(cmd,args)=>cp.execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function install(){
  if(process.getuid?.()!==0)throw Error('ROOT_REQUIRED');
  const user=run('systemctl',['show','blend-pick','--property=User','--value'])||'root';
  if(!/^[a-zA-Z0-9_-]+$/.test(user))throw Error('INVALID_SERVICE_USER');
  const cwd=process.cwd(),script=path.join(cwd,'scripts/retain-visit-analytics.cjs');
  fs.writeFileSync('/etc/systemd/system/blendpick-visit-retention.service',`[Unit]\nDescription=Remove visit analytics older than 90 days\nAfter=network-online.target\n[Service]\nType=oneshot\nUser=${user}\nWorkingDirectory=${systemdQuote(cwd)}\nExecStart=${systemdQuote(process.execPath)} ${systemdQuote(script)}\nTimeoutStartSec=120\nNoNewPrivileges=true\nPrivateTmp=true\nProtectSystem=strict\n`,{mode:0o644});
  fs.writeFileSync('/etc/systemd/system/blendpick-visit-retention.timer','[Unit]\nDescription=Daily visit analytics retention\n[Timer]\nOnCalendar=*-*-* 03:30:00 Asia/Seoul\nPersistent=true\nRandomizedDelaySec=60\n[Install]\nWantedBy=timers.target\n',{mode:0o644});
  run('systemctl',['daemon-reload']);run('systemctl',['enable','--now','blendpick-visit-retention.timer']);run('systemctl',['start','blendpick-visit-retention.service']);run('systemctl',['is-active','--quiet','blendpick-visit-retention.timer']);
  console.log('Visit analytics retention: daily timer active.');
}
install();
