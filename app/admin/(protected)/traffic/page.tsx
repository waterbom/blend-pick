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
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs text-emerald-800">{site.name} · 서버 운영</p><h1 className="mt-1 text-2xl font-bold">서버 트래픽</h1><p className="mt-2 text-sm text-stone-500">요청·전송량·서버 오류·응답 시간 · 한국시간</p></div><nav aria-label="트래픽 조회 기간" className="flex gap-1">{[1,7,30].map(d=><a key={d} href={`?days=${d}`} aria-current={days===d?'page':undefined} className={`rounded-lg border px-3 py-2 text-xs ${days===d?'bg-emerald-900 text-white':'bg-white'}`}>{d===1?'오늘':`최근 ${d}일`}</a>)}</nav></header>
    <ServerTrafficPanel key={days} data={traffic}/>
    <div className="flex gap-4 text-sm text-emerald-800"><a className="underline" href="/admin/visits">방문 통계 →</a><a className="underline" href="/admin/monitoring">자동 점검 →</a></div>
  </div>;
}
