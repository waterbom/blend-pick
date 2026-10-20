'use client';
import {useTransition} from 'react';
import {useRouter} from 'next/navigation';
export default function DashboardRefresh(){
 const router=useRouter(),[pending,start]=useTransition();
 return <button type="button" className="overview-refresh" disabled={pending} aria-busy={pending} onClick={()=>start(()=>router.refresh())}>{pending?'갱신 중…':'새로고침'}</button>;
}
