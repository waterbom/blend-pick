'use client';
import Link from 'next/link';
import {useState} from 'react';
import {usePathname} from 'next/navigation';
import type {SiteKey} from '@/lib/sites';
import {adminGroups,adminLocation} from '@/lib/admin-navigation';
import AdminIcon from './AdminIcon';
function MenuSearch({siteKey}:{siteKey:SiteKey}) {
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false);
 const results=adminGroups(siteKey).flatMap(g=>g.items.map(i=>({...i,group:g.label}))).filter(i=>(i.label+' '+i.group).includes(query.trim()));
 return <div className="commerce-search" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setOpen(false);}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>
 <AdminIcon name="search"/><input aria-label="관리 메뉴 검색" placeholder="어떤 업무를 찾으세요?" value={query} onChange={e=>{setQuery(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)}/>
 {open&&query.trim()&&<div className="commerce-search-results"><p>{results.length}개 메뉴</p>{results.length?results.map(i=><Link key={i.href} href={i.href} onClick={()=>{setOpen(false);setQuery('');}}><span>{i.label}</span><small>{i.group}</small></Link>):<p role="status">일치하는 메뉴가 없습니다.</p>}</div>}
 </div>;
}
export default function AdminWorkspaceHeader({siteKey}:{siteKey:SiteKey}) {
 const path=usePathname(),location=adminLocation(path,siteKey);
 const group=adminGroups(siteKey).find(g=>g.label===location.group);
 return <header className="commerce-workspace-header"><div className="commerce-heading-row"><div className="commerce-workspace-identity"><span className="commerce-site-dot"/><p><strong>{siteKey==='sanjipick'?'산지픽':'블랜드픽'}</strong><span> 판매자 워크스페이스</span></p></div><div className="commerce-header-actions"><MenuSearch key={path+siteKey} siteKey={siteKey}/><Link href="/admin/notifications" className="commerce-icon-button" aria-label="카카오 상담·알림" title="카카오 상담·알림"><AdminIcon name="bell"/></Link><Link href="/admin/products/new" className="commerce-create-button"><AdminIcon name="plus"/><span>상품 등록</span></Link></div></div>
 <div className="commerce-context-row"><nav aria-label={`${location.group} 관련 업무`} className="commerce-context-tabs">{group?.items.map(i=><Link key={i.href} href={i.href} aria-current={location.href===i.href?'page':undefined}>{i.label}</Link>)}</nav><span className="commerce-section-label">{location.group}</span></div></header>;
}
