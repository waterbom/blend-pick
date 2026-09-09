'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {SiteKey} from '@/lib/sites';
import {adminGroups,adminLocation} from '@/lib/admin-navigation';
export default function AdminWorkspaceHeader({siteKey}:{siteKey:SiteKey}) {
 const path=usePathname(),location=adminLocation(path,siteKey);
 const group=adminGroups(siteKey).find(g=>g.label===location.group);
 return <header className="commerce-workspace-header"><div className="commerce-heading-row"><p>{siteKey==='sanjipick'?'산지픽':'블랜드픽'} <span>/ {location.group} /</span> <strong>{location.label}</strong></p><div><Link href="/admin/operations">오늘 할 일</Link><Link href="/admin/notifications">카카오 상담·알림</Link></div></div>
 <nav aria-label={`${location.group} 관련 업무`} className="commerce-context-tabs">{group?.items.map(i=><Link key={i.href} href={i.href} aria-current={location.href===i.href?'page':undefined}>{i.label}</Link>)}</nav></header>;
}
