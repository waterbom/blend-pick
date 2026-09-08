// 공개 GET 및 인증 없는 접근 제한 확인만 수행. 쿠키·인증정보·DB·결제·문자 미사용.
const { SITES, POLICY, PROBES } = require('./config.cjs');
const ISSUE = {
  NETWORK: ['fail', '응답을 받지 못했습니다.', '호스팅 상태와 도메인·인증서·네트워크 연결을 확인하세요.'],
  TIMEOUT: ['fail', '15초 안에 응답 읽기를 완료하지 못했습니다.', '서버 부하와 느린 상품 조회를 확인하세요.'],
  HTTP: ['fail', '예상하지 않은 HTTP 응답입니다.', '해당 경로를 열어 보고 서버 오류·배포 로그를 확인하세요.'],
  REDIRECT: ['fail', '다른 도메인 또는 허용하지 않은 경로로 이동합니다.', '도메인 분기와 로그인 리다이렉트 설정을 확인하세요.'],
  TOO_LARGE: ['warn', '응답이 5MiB를 초과해 내용 검사를 중단했습니다.', '페이지·사이트맵 크기를 확인하세요. 전체 내용은 검사하지 못했습니다.'],
  HTML: ['fail', 'HTML 화면 구조를 확인하지 못했습니다.', '정상 페이지 대신 오류 또는 다른 응답이 반환되는지 확인하세요.'],
  TITLE: ['warn', '페이지 제목이 없거나 비어 있습니다.', '페이지별 검색 제목 설정을 확인하세요.'],
  NOINDEX: ['warn', '검색 제외(noindex) 설정이 있습니다.', '공개 페이지에 의도한 설정인지 확인하고 검색 설정을 수정하세요.'],
  SAMPLE: ['warn', '예시 상품으로 연결되는 공개 링크가 있습니다.', '실제 상품 연결 여부와 예시 데이터 대체 처리를 확인하세요.'],
  ERROR_SCREEN: ['fail', '상품 조회 오류 화면이 표시됩니다.', '상품 조회 오류와 데이터베이스 연결 상태를 확인하세요.'],
  ROBOTS: ['warn', '현재 사이트의 사이트맵 주소가 robots.txt에 없습니다.', '사이트별 robots.txt의 Sitemap 주소를 맞추세요.'],
  BLOCKED: ['warn', '일반 검색 로봇의 사이트 루트 수집이 차단되어 있습니다.', 'robots.txt의 User-agent: * 그룹과 Allow·Disallow를 확인하세요.'],
  SITEMAP: ['warn', '사이트맵의 기본 구조 또는 주소가 올바르지 않습니다.', '사이트맵 생성 결과와 도메인·예시 상품 주소를 확인하세요.'],
  AUTH: ['fail', '비로그인 접근이 예상대로 차단되지 않았습니다.', '관리자 인증·접근 제한을 우선 확인하세요. 응답 내용은 수집하지 않았습니다.'],
  SLOW: ['warn', '응답 읽기에 3초 이상 걸렸습니다.', '같은 경로를 다시 확인하고 서버·이미지 응답 시간을 살펴보세요. 단일 관측값입니다.'],
  RECOVERED: ['warn', '첫 응답은 실패했지만 재확인에서 정상 응답했습니다.', '일시 장애 여부를 확인하세요. 이전 실행과의 복구 비교는 아닙니다.'],
};
const issue = (code, extra = '') => ({ code, severity: ISSUE[code][0], reason: ISSUE[code][1] + extra, action: ISSUE[code][2] });
const decode = value => value.replace(/&amp;/gi, '&').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, h, d) => {
  const n = parseInt(h || d, h ? 16 : 10); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
});
function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4]);
  return out;
}
function productPath(value, origin) {
  try {
    const url = new URL(decode(value), origin);
    if (url.origin !== origin || url.username || url.password || url.search) return null;
    return /^\/(?:products|p|sanji\/p)\/[a-z0-9_-]{1,100}\/?$/i.test(url.pathname) ? url.pathname : null;
  } catch { return null; }
}
function links(body, origin) {
  return [...new Set([...body.matchAll(/<a\b[^>]*>/gi)].map(m => productPath(attrs(m[0]).href || '', origin)).filter(Boolean))];
}
function sitemapLocations(body) {
  return [...body.matchAll(/<loc\b[^>]*>\s*([^<]+?)\s*<\/loc>/gi)].map(m => decode(m[1].trim()));
}
function rootBlocked(body) {
  const groups = []; let group = { agents: [], rules: [] };
  for (const raw of body.split(/\r?\n/)) {
    const match = raw.replace(/#.*$/, '').match(/^\s*(user-agent|allow|disallow)\s*:\s*(.*?)\s*$/i);
    if (!match) continue;
    const [, key, value] = match;
    if (key.toLowerCase() === 'user-agent') {
      if (group.rules.length) { groups.push(group); group = { agents: [], rules: [] }; }
      group.agents.push(value.toLowerCase());
    } else group.rules.push({ allow: key.toLowerCase() === 'allow', value });
  }
  groups.push(group);
  const rules = groups.filter(g => g.agents.includes('*')).flatMap(g => g.rules).filter(r => r.value === '/' || r.value === '/*' || r.value === '/$');
  return rules.some(r => !r.allow) && !rules.some(r => r.allow);
}
async function readBounded(response, controller, limit) {
  if (Number(response.headers.get('content-length')) > limit) { controller.abort(); throw Error('TOO_LARGE'); }
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); controller.abort(); throw Error('TOO_LARGE'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
async function request(site, probe, fetcher, policy, clock) {
  const started = clock(); const controller = new AbortController(); let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, policy.timeoutMs);
  let url = new URL(probe.path, site.origin).href;
  try {
    for (let hop = 0; hop <= policy.maxRedirects; hop++) {
      const response = await fetcher(url, { method: 'GET', redirect: 'manual', credentials: 'omit', signal: controller.signal, headers: { 'User-Agent': 'Blendpick-ReadOnly-Monitor/1.0' } });
      const status = response.status, location = response.headers.get('location');
      if (probe.kind === 'admin' || probe.kind === 'admin-api') {
        // 접근이 잘못 허용돼도 고객·주문 내용은 읽거나 보고서에 담지 않는다.
        if (response.body) await response.body.cancel();
        let loginRedirect = false;
        try { const target = new URL(location, url); loginRedirect = !!location && target.origin === site.origin && target.pathname === '/login' && !target.username && !target.password; } catch {}
        const denied = status === 401 || status === 403 || (probe.kind === 'admin' && [301,302,303,307,308].includes(status) && loginRedirect);
        return { status, body: '', durationMs: clock() - started, issues: denied ? [] : [issue('AUTH')], retryable: status >= 500 || status === 429 };
      }
      if ([301,302,303,307,308].includes(status)) {
        if (response.body) await response.body.cancel();
        let target; try { target = new URL(location, url); } catch {}
        if (!location || !target || target.origin !== site.origin || target.username || target.password || hop === policy.maxRedirects || target.pathname.replace(/\/$/, '') !== probe.path.split('?')[0].replace(/\/$/, '')) {
          return { status, body: '', durationMs: clock() - started, issues: [issue('REDIRECT')], retryable: false };
        }
        url = target.href; continue;
      }
      if (status !== 200) {
        if (response.body) await response.body.cancel();
        return { status, body: '', durationMs: clock() - started, issues: [issue('HTTP', ` HTTP ${status}`)], retryable: status >= 500 || status === 429 };
      }
      const body = await readBounded(response, controller, policy.maxBodyBytes);
      return { status, body, robotsHeader: response.headers.get('x-robots-tag') || '', durationMs: clock() - started, issues: [], retryable: false };
    }
  } catch (error) {
    const code = error.message === 'TOO_LARGE' ? 'TOO_LARGE' : timedOut ? 'TIMEOUT' : 'NETWORK';
    return { status: null, body: '', durationMs: clock() - started, issues: [issue(code)], retryable: code !== 'TOO_LARGE' };
  } finally { clearTimeout(timer); }
}
function analyze(site, probe, response) {
  const result = [...response.issues]; const body = response.body;
  if (result.length) return result;
  if (['page','login','product'].includes(probe.kind)) {
    if (!/<html(?:\s|>)/i.test(body) || !/<body(?:\s|>)/i.test(body)) result.push(issue('HTML'));
    if (!/<title\b[^>]*>\s*[^\s<][\s\S]*?<\/title>/i.test(body)) result.push(issue('TITLE'));
    if (/data-storefront-state\s*=\s*["']error["']/i.test(body) || /Application error:|Internal Server Error/i.test(body)) result.push(issue('ERROR_SCREEN'));
    if (probe.kind !== 'login') {
      const noindex = /\b(noindex|none)\b/i.test(response.robotsHeader) || [...body.matchAll(/<meta\b[^>]*>/gi)].some(m => { const a = attrs(m[0]); return /^(robots|googlebot|bingbot|naverbot|yeti)$/i.test(a.name || '') && /\b(noindex|none)\b/i.test(a.content || ''); });
      if (noindex) result.push(issue('NOINDEX'));
      if (links(body, site.origin).some(p => /\/p\/demo/i.test(p))) result.push(issue('SAMPLE'));
    }
  }
  if (probe.kind === 'robots') {
    const maps = [...body.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map(m => m[1]);
    if (!maps.includes(site.origin + '/sitemap.xml')) result.push(issue('ROBOTS'));
    if (rootBlocked(body)) result.push(issue('BLOCKED'));
  }
  if (probe.kind === 'sitemap') {
    const locations = sitemapLocations(body);
    const invalid = !/<urlset(?:\s|>)/i.test(body) || !/<\/urlset>\s*$/i.test(body) || !locations.length || locations.some(value => {
      try { const u = new URL(value); return u.origin !== site.origin || !!u.username || !!u.password || /\/p\/demo/i.test(u.pathname); } catch { return true; }
    });
    if (invalid) result.push(issue('SITEMAP'));
  }
  return result;
}
async function inspect(site, probe, options) {
  const { policy, fetcher, clock, sleep } = options; const attempts = []; let response;
  for (let n = 0; n <= policy.maxRetries; n++) {
    if (n) await sleep(policy.retryDelayMs);
    response = await request(site, probe, fetcher, policy, clock);
    attempts.push({ number: n + 1, httpStatus: response.status, durationMs: response.durationMs, issueCodes: response.issues.map(i => i.code) });
    if (!response.retryable) break;
  }
  const issues = analyze(site, probe, response);
  if (attempts.length > 1 && !response.issues.length) issues.push(issue('RECOVERED'));
  if (response.durationMs >= policy.slowMs && !response.issues.length) issues.push(issue('SLOW'));
  const status = issues.some(x => x.severity === 'fail') ? 'fail' : issues.length ? 'warn' : 'pass';
  const row = { key: probe.key, title: probe.title, path: probe.path, status, httpStatus: response.status, durationMs: response.durationMs, attempts, issues,
    note: /data-storefront-state\s*=\s*["']empty["']/i.test(response.body) ? '판매 준비 상태입니다. 상품이 없다는 이유만으로 장애로 판단하지 않습니다.' : '' };
  return { row, body: response.body };
}
async function checkSite(site, options) {
  const checks = []; const samples = new Set();
  for (const probe of PROBES) {
    const { row, body } = await inspect(site, probe, options); checks.push(row);
    if (probe.kind === 'page') links(body, site.origin).forEach(p => samples.add(p));
    if (probe.kind === 'sitemap') sitemapLocations(body).map(value => productPath(value, site.origin)).filter(Boolean).forEach(p => samples.add(p));
  }
  const selected = [...samples].filter(p => !/\/p\/demo/i.test(p)).slice(0, options.policy.productSamples);
  for (const [index, path] of selected.entries()) checks.push((await inspect(site, { key: 'product-' + (index + 1), title: '상품 상세 표본 ' + (index + 1), kind: 'product', path }, options)).row);
  if (!selected.length) checks.push({ key: 'product-samples', title: '상품 상세 표본', path: '/products', status: 'skip', attempts: [], issues: [], httpStatus: null, durationMs: null, note: '허용된 상품 링크를 찾지 못해 미검사입니다. 상품이 실제로 없는지는 이 결과만으로 확정할 수 없습니다.' });
  return { ...site, checks };
}
async function runMonitor(options = {}) {
  const settings = { policy: { ...POLICY, ...options.policy }, fetcher: options.fetcher || fetch, clock: options.clock || (() => performance.now()), sleep: options.sleep || (ms => new Promise(r => setTimeout(r, ms))) };
  const startedAt = new Date().toISOString();
  const sites = await Promise.all(SITES.map(site => checkSite(site, settings)));
  const counts = { pass: 0, warn: 0, fail: 0, skip: 0 };
  sites.flatMap(site => site.checks).forEach(row => counts[row.status]++);
  return { version: 1, mode: 'observed', startedAt, finishedAt: new Date().toISOString(), policy: settings.policy, counts, sites };
}
module.exports = { runMonitor, productPath, rootBlocked, analyze, ISSUE };
