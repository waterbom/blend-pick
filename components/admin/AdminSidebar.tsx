'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import type {SiteKey} from '@/lib/sites';
import {adminGroups,adminLocation} from '@/lib/admin-navigation';
export default function AdminSidebar({siteKey='blendpick'}:{siteKey?:SiteKey}) {
 const path=usePathname(),groups=adminGroups(siteKey),current=adminLocation(path,siteKey);
 const [mobile,setMobile]=useState(false),[favorites,setFavorites]=useState<string[]>([]);
 const [ready,setReady]=useState(false);
 const storage='commerce-favorites:'+siteKey;
 useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(storage)||'[]');setFavorites(Array.isArray(value)?value.filter(v=>typeof v==='string'):[]);}catch{setFavorites([]);}setReady(true);},[storage]);
 function toggle(href:string){const next=favorites.includes(href)?favorites.filter(x=>x!==href):[...favorites,href];setFavorites(next);try{localStorage.setItem(storage,JSON.stringify(next));}catch{/* Favorites remain usable for this visit. */}}
 const links=groups.flatMap(g=>g.items),saved=links.filter(i=>favorites.includes(i.href));
 return <>
 <div className="commerce-mobile"><strong>{siteKey==='sanjipick'?'산지픽':'블랜드픽'} 판매자센터</strong><button type="button" aria-expanded={mobile} onClick={()=>setMobile(!mobile)}>{mobile?'메뉴 닫기':'메뉴 열기'}</button></div>
 <aside className={'commerce-sidebar '+(mobile?'is-open':'')}>
 <Link href="/admin" className="commerce-brand"><span>{siteKey==='sanjipick'?'산지픽':'블랜드픽'}</span><small>판매자센터</small></Link>
 <div className="commerce-site">현재 운영 사이트 <strong>{siteKey==='sanjipick'?'산지픽':'블랜드픽'}</strong><Link href="/" target="_blank">스토어 보기 ↗</Link></div>
 <nav aria-label="관리자 메뉴">
 {ready&&saved.length>0&&<div className="commerce-favorites"><b>즐겨찾기</b>{saved.map(i=><Link key={i.href} href={i.href} onClick={()=>setMobile(false)}>{i.label}</Link>)}</div>}
 {groups.map(g=><details key={g.label+current.group} open={g.label===current.group} className="commerce-nav-group"><summary>{g.label}</summary><div>{g.items.map(i=><div className={'commerce-nav-row '+(current.href===i.href?'is-active':'')} key={i.href}><Link href={i.href} aria-current={current.href===i.href?'page':undefined} onClick={()=>setMobile(false)}>{i.label}</Link><button type="button" aria-label={`${i.label} 즐겨찾기 ${favorites.includes(i.href)?'해제':'추가'}`} aria-pressed={favorites.includes(i.href)} onClick={()=>toggle(i.href)}>{favorites.includes(i.href)?'★':'☆'}</button></div>)}</div></details>)}
 </nav>
 <form action="/api/admin/logout" method="POST" className="commerce-logout"><button>로그아웃</button></form>
 </aside></>;
}
