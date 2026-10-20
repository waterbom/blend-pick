import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import { currentAdminSite } from '@/lib/admin-site';
import { getServerTraffic } from '@/lib/server-traffic';
import ServerTrafficPanel from '@/components/admin/ServerTrafficPanel';
export const dynamic='force-dynamic';
export default async function TrafficPage({searchParams}:{searchParams:Promise<{days?:string}>}) {
  const token=(await cookies()).get('admin_token')?.value;
  if(!token || !(await verifyAdminToken(token)))redirect('/login?redirect=%2Fadmin%2Ftraffic');
  const site=await currentAdminSite(),params=await searchParams;
  const days=['1','7','30'].includes(params.days||'')?Number(params.days):7;
  const traffic=await getServerTraffic(site.key,days);
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs text-emerald-800">{site.name} · 서버 운영</p><h1 className="mt-1 text-2xl font-bold">트래픽·자동 점검</h1><p className="mt-2 text-sm text-stone-500">요청·전송량·서버 오류·응답 시간 · 한국시간</p></div><nav aria-label="트래픽 조회 기간" className="flex gap-1">{[1,7,30].map(d=><a key={d} href={`?days=${d}`} aria-current={days===d?'page':undefined} className={`rounded-lg border px-3 py-2 text-xs ${days===d?'bg-emerald-900 text-white':'bg-white'}`}>{d===1?'오늘':`최근 ${d}일`}</a>)}</nav></header>
    <ServerTrafficPanel key={days} data={traffic}/>
    <section id="checks" className="overview-panel overview-system-check"><h2>자동 점검</h2><p>메인·상품 연결, 로그인·관리자 접근, 검색 설정을 30분 간격과 배포 후에 확인합니다.</p><p className="overview-footnote">최신 정상·주의·실패 여부는 실행 기록에서 확인하세요. 이 화면이 실시간 상태를 판정하지는 않습니다.</p><a href="https://github.com/waterbom/blend-pick/actions/workflows/storefront-monitor.yml" target="_blank" rel="noopener noreferrer">점검 실행 기록 보기 →</a></section>
    <a className="text-sm underline" href="/admin#visits">운영 홈의 방문 통계로 이동 →</a>
  </div>;
}
