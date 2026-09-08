const { SITES, POLICY } = require('./config.cjs');
const { ISSUE } = require('./engine.cjs');
function exampleReport() {
  const issue = code => ({ code, severity: ISSUE[code][0], reason: ISSUE[code][1], action: ISSUE[code][2] });
  const row = (key,title,path,status,httpStatus,durationMs,codes=[]) => ({key,title,path,status,httpStatus,durationMs,attempts: status==='skip'?[]:[{number:1,httpStatus,durationMs,issueCodes:codes}],issues:codes.map(issue),note:''});
  const sites = SITES.map(s => ({...s,checks:[]}));
  sites[0].checks = [row('home','메인 화면','/','pass',200,410),row('catalog','상품 목록','/products','warn',200,3420,['SLOW']),row('product-1','상품 상세 표본 1','/products/example-product','fail',404,280,['HTTP']),row('login','로그인 화면 접속','/login','pass',200,230),row('admin','비로그인 관리자 화면 차단','/admin/operations','pass',307,120),row('admin-api','비로그인 관리자 API 차단','/api/admin/returns?kind=return','pass',401,105),row('robots','검색 수집 설정','/robots.txt','pass',200,80),row('sitemap','사이트맵 기본 구조·주소','/sitemap.xml','pass',200,90)];
  sites[1].checks = [row('home','메인 화면','/','pass',200,350),row('catalog','상품 목록','/products','warn',200,720,['RECOVERED']),row('product-samples','상품 상세 표본','/products','skip',null,null),row('login','로그인 화면 접속','/login','pass',200,220),row('admin','비로그인 관리자 화면 차단','/admin/operations','pass',307,130),row('admin-api','비로그인 관리자 API 차단','/api/admin/returns?kind=return','pass',401,110),row('robots','검색 수집 설정','/robots.txt','warn',200,90,['BLOCKED']),row('sitemap','사이트맵 기본 구조·주소','/sitemap.xml','pass',200,100)];
  sites[1].checks[0].note='판매 준비 상태 예시입니다. 상품이 없다는 이유만으로 장애로 판단하지 않습니다.';
  sites[1].checks[1].attempts=[{number:1,httpStatus:503,durationMs:300,issueCodes:['HTTP']},{number:2,httpStatus:200,durationMs:720,issueCodes:[]}];
  sites[1].checks[2].note='상품 링크를 찾지 못했습니다. 상품이 실제로 없는지는 이 결과만으로 확정할 수 없습니다.';
  const counts={pass:0,warn:0,fail:0,skip:0};sites.flatMap(s=>s.checks).forEach(r=>counts[r.status]++);
  return {version:1,mode:'example',startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),policy:POLICY,counts,sites};
}
module.exports={exampleReport};
