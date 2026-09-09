// npm exec --yes --package=esbuild -- esbuild scripts/preview-admin-charts.tsx --bundle --minify --outfile=/tmp/blendpick-charts-preview.js --define:process.env.NODE_ENV='"production"'
// node scripts/package-charts-preview.cjs /tmp/blendpick-charts-preview.js /absolute/output.html
const fs=require('node:fs'),path=require('node:path');
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);
const css=files('.next/static').filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync(f,'utf8')).join('\n');
const js=fs.readFileSync(process.argv[2],'utf8').replace(/<\/script/gi,'<\\/script');
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>블랜드픽·산지픽 관리자 통계 그래프 미리보기</title><style>${css}\nbody{margin:0;font-family:system-ui,-apple-system,sans-serif}button,summary{cursor:pointer}svg [tabindex]:focus{outline:2px solid #315e43}</style></head><body><div id="app"></div><script>${js}</script></body></html>`;
fs.writeFileSync(process.argv[3],html);console.log('Preview written');
