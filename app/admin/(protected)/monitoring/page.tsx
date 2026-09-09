import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import { currentAdminSite } from '@/lib/admin-site';
export const dynamic='force-dynamic';
export default async function MonitoringPage() {
  const token=(await cookies()).get('admin_token')?.value;
  if(!token || !(await verifyAdminToken(token)))redirect('/login?redirect=%2Fadmin%2Fmonitoring');
  const site=await currentAdminSite();
  return <div className="mx-auto max-w-5xl space-y-6">
    <header><p className="text-xs text-emerald-800">{site.name} · 운영 점검</p><h1 className="mt-1 text-2xl font-bold">자동 점검</h1><p className="mt-2 text-sm text-stone-500">30분 간격·배포 후 실행하는 사이트 점검입니다.</p></header>
    <section className="rounded-2xl border border-stone-200 bg-white p-6"><h2 className="font-semibold">점검 항목과 실행 결과</h2><ul className="my-4 space-y-2 text-sm text-stone-600"><li>메인·상품 목록·상품 상세 연결</li><li>로그인 진입과 관리자 접근 차단</li><li>검색 수집 설정과 사이트맵</li></ul><p className="text-xs text-stone-500">최신 정상·주의·실패 결과는 실행 기록에서 확인하세요. 이 화면은 실시간 상태를 판정하지 않습니다.</p><a href="https://github.com/waterbom/blend-pick/actions/workflows/storefront-monitor.yml" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-lg bg-emerald-900 px-4 py-3 text-sm text-white">점검 실행 기록 보기</a></section>
    <div className="grid gap-4 sm:grid-cols-2"><a href="/admin/visits" className="rounded-xl border bg-white p-5"><b>방문 통계 →</b><p className="mt-2 text-sm text-stone-500">방문자·세션·페이지 조회 추이</p></a><a href="/admin/traffic" className="rounded-xl border bg-white p-5"><b>서버 트래픽 →</b><p className="mt-2 text-sm text-stone-500">시간별 요청·전송량·서버 오류</p></a></div>
  </div>;
}
