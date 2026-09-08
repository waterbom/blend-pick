const SITES = [
  { key: 'blendpick', name: '블랜드픽', origin: 'https://shop.blendpunch.com' },
  { key: 'sanjipick', name: '산지픽', origin: 'https://sanjipick.blendpunch.com' },
];
const POLICY = Object.freeze({ timeoutMs: 15000, slowMs: 3000, retryDelayMs: 1000, maxRetries: 1, maxBodyBytes: 5 * 1024 * 1024, productSamples: 3, maxRedirects: 3 });
const PROBES = [
  { key: 'home', title: '메인 화면', path: '/', kind: 'page' },
  { key: 'catalog', title: '상품 목록', path: '/products', kind: 'page' },
  { key: 'login', title: '로그인 화면 접속', path: '/login', kind: 'login' },
  { key: 'robots', title: '검색 수집 설정', path: '/robots.txt', kind: 'robots' },
  { key: 'sitemap', title: '사이트맵 기본 구조·주소', path: '/sitemap.xml', kind: 'sitemap' },
  { key: 'admin', title: '비로그인 관리자 화면 차단', path: '/admin/operations', kind: 'admin' },
  { key: 'admin-api', title: '비로그인 관리자 API 차단', path: '/api/admin/returns?kind=return', kind: 'admin-api' },
];
module.exports = { SITES, POLICY, PROBES };
