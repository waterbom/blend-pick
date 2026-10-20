const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {retentionUnits}=require('../scripts/install-visit-analytics-retention.cjs');

test('systemd accepts the installed retention service and timer, including spaces and literal percent paths',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'visit retention 100%-'));
  try{
    const units=retentionUnits({user:'root',cwd,node:process.execPath});
    const serviceFile=path.join(cwd,'blendpick-visit-retention.service'),timerFile=path.join(cwd,'blendpick-visit-retention.timer');
    fs.writeFileSync(serviceFile,units.service);fs.writeFileSync(timerFile,units.timer);
    const result=cp.spawnSync('systemd-analyze',['verify',serviceFile,timerFile],{encoding:'utf8'});
    assert.ifError(result.error);
    assert.equal(result.status,0,result.stderr);
  }finally{fs.rmSync(cwd,{recursive:true,force:true});}
});

test('retention unit rejects relative paths and injected unit directives',()=>{
  for(const cwd of ['relative/path','/app\nExecStart=/usr/bin/false','/app\0other','/app ']){
    assert.throws(()=>retentionUnits({user:'root',cwd,node:process.execPath}),/INVALID_WORKING_DIRECTORY/);
  }
});
