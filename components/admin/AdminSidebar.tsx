'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import type {SiteKey} from '@/lib/sites';
import {adminLocation,adminPrimaryLinks,adminSupportingGroups} from '@/lib/admin-navigation';
import AdminIcon, {type AdminIconName} from '@/components/admin/AdminIcon';
const icons:Record<string,AdminIconName>={'/admin':'home','/admin/orders':'box','/admin/shipments':'truck','/admin/products':'box','/admin/product-sales':'chart','/admin/settlements':'chart','/admin/members':'users','/admin/reviews':'check','/admin/reservations':'calendar'};
export default function AdminSidebar({siteKey='blendpick'}:{siteKey?:SiteKey}) {
 const path=usePathname(),current=adminLocation(path,siteKey),primary=adminPrimaryLinks(siteKey),supporting=adminSupportingGroups(siteKey);
 const [mobile,setMobile]=useState(false);
 const mobileButton=useRef<HTMLButtonElement>(null);
 const isSupporting=supporting.some(g=>g.items.some(i=>i.href===current.href));
 useEffect(()=>{if(!mobile)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMobile(false);mobileButton.current?.focus();}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[mobile]);
 return <>
  <a href="#admin-content" className="commerce-skip">본문으로 이동</a>
  <div className="commerce-mobile"><Link href="/admin">{siteKey==='sanjipick'?'산지픽':'블랜드픽'} <span>판매자센터</span></Link><button ref={mobileButton} type="button" aria-controls="admin-navigation" aria-expanded={mobile} aria-label={mobile?'메뉴 닫기':'메뉴 열기'} onClick={()=>setMobile(!mobile)}><AdminIcon name={mobile?'close':'menu'}/></button></div>
  <aside id="admin-navigation" className={`commerce-sidebar commerce-sidebar-direct ${mobile?'is-open':''}`}>
   <Link href="/admin" className="commerce-brand" aria-label={`${siteKey==='sanjipick'?'산지픽':'블랜드픽'} 운영 홈`} onClick={()=>setMobile(false)}><span className="commerce-brand-mark">{siteKey==='sanjipick'?'S':'B'}<i/></span><span className="commerce-brand-name">{siteKey==='sanjipick'?'산지픽':'블랜드픽'}<small>판매자센터</small></span></Link>
   <nav aria-label="관리자 핵심 메뉴" className="commerce-primary-nav">{primary.map(i=><Link prefetch={false} key={i.href} href={i.href} className={`commerce-direct-link ${current.href===i.href||(i.href!=='/admin'&&path.startsWith(i.href+'/'))?'is-active':''}`} aria-current={current.href===i.href?'page':undefined} onClick={()=>setMobile(false)}><AdminIcon name={icons[i.href]}/><span>{i.label}</span></Link>)}</nav>
   <details className="commerce-tools" key={isSupporting?'tools-active':'tools-idle'} open={isSupporting}><summary><AdminIcon name="settings"/><span>기타 관리</span></summary><nav aria-label="보조 관리 메뉴">{supporting.map(g=><div key={g.label}><p>{g.label}</p>{g.items.map(i=><Link prefetch={false} key={i.href} href={i.href} aria-current={current.href===i.href?'page':undefined} onClick={()=>setMobile(false)}>{i.label}</Link>)}</div>)}</nav></details>
   <div className="commerce-sidebar-bottom">
    {/* A full navigation restores the storefront header in this same window. */}
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <a href="/" className="commerce-store-link"><AdminIcon name="box"/><span>스토어 보기</span><AdminIcon name="arrow"/></a>
    <form action="/api/admin/logout" method="POST" className="commerce-logout"><button><AdminIcon name="logout"/><span>로그아웃</span></button></form>
   </div>
  </aside>
 </>;
}
