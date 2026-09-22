'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import type {SiteKey} from '@/lib/sites';
import {adminGroups,adminLocation} from '@/lib/admin-navigation';
import AdminIcon, {type AdminIconName} from './AdminIcon';
const icons:AdminIconName[]=['home','box','truck','chart','users','calendar','settings'];
const shortLabels=['홈','상품','주문·배송','매출','고객','공구','시스템'];
export default function AdminSidebar({siteKey='blendpick'}:{siteKey?:SiteKey}) {
 const path=usePathname(),groups=adminGroups(siteKey),current=adminLocation(path,siteKey);
 const [mobile,setMobile]=useState(false),[expanded,setExpanded]=useState(false),[favorites,setFavorites]=useState<string[]>([]);
 const [ready,setReady]=useState(false);
 const mobileButton=useRef<HTMLButtonElement>(null);
 const storage='commerce-favorites:'+siteKey;
 useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(storage)||'[]');setFavorites(Array.isArray(value)?value.filter(v=>typeof v==='string'):[]);}catch{setFavorites([]);}setReady(true);},[storage]);
 useEffect(()=>{if(!mobile)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMobile(false);mobileButton.current?.focus();}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[mobile]);
 function toggle(href:string){const next=favorites.includes(href)?favorites.filter(x=>x!==href):[...favorites,href];setFavorites(next);try{localStorage.setItem(storage,JSON.stringify(next));}catch{/* Keep favorites for this visit. */}}
 const links=groups.flatMap(g=>g.items),saved=links.filter(i=>favorites.includes(i.href));
 const full=expanded||mobile;
 return <>
 <a href="#admin-content" className="commerce-skip">본문으로 이동</a>
 <div className="commerce-mobile"><Link href="/admin">{siteKey==='sanjipick'?'산지픽':'블랜드픽'} <span>판매자센터</span></Link><button ref={mobileButton} type="button" aria-controls="admin-navigation" aria-expanded={mobile} aria-label={mobile?'메뉴 닫기':'메뉴 열기'} onClick={()=>setMobile(!mobile)}><AdminIcon name={mobile?'close':'menu'}/></button></div>
 <aside id="admin-navigation" className={`commerce-sidebar ${mobile?'is-open':''} ${expanded?'is-expanded':''}`}>
 <Link href="/admin" className="commerce-brand" aria-label={`${siteKey==='sanjipick'?'산지픽':'블랜드픽'} 운영 홈`} onClick={()=>setMobile(false)}><span className="commerce-brand-mark">{siteKey==='sanjipick'?'S':'B'}<i/></span>{full&&<span className="commerce-brand-name">{siteKey==='sanjipick'?'산지픽':'블랜드픽'}<small>판매자센터</small></span>}</Link>
 <button type="button" className="commerce-expand" aria-expanded={expanded} aria-label={expanded?'메뉴 접기':'전체 메뉴 펼치기'} onClick={()=>setExpanded(!expanded)}><AdminIcon name="menu"/>{expanded&&<span>메뉴 접기</span>}</button>
 <nav aria-label="관리자 메뉴">
 {full&&ready&&saved.length>0&&<div className="commerce-favorites"><b>즐겨찾기</b>{saved.map(i=><Link key={i.href} href={i.href} onClick={()=>setMobile(false)}>{i.label}</Link>)}</div>}
 {groups.map((g,index)=>full?<details key={g.label+current.group} open={g.label===current.group} className="commerce-nav-group"><summary><AdminIcon name={icons[index]}/><span>{g.label}</span></summary><div>{g.items.map(i=><div className={'commerce-nav-row '+(current.href===i.href?'is-active':'')} key={i.href}><Link href={i.href} aria-current={current.href===i.href?'page':undefined} onClick={()=>setMobile(false)}>{i.label}</Link><button type="button" aria-label={`${i.label} 즐겨찾기 ${favorites.includes(i.href)?'해제':'추가'}`} aria-pressed={favorites.includes(i.href)} onClick={()=>toggle(i.href)}>{favorites.includes(i.href)?'★':'☆'}</button></div>)}</div></details>:<Link key={g.label} href={g.items[0].href} className={`commerce-rail-link ${current.group===g.label?'is-active':''}`} aria-label={g.label} title={g.label} aria-current={current.group===g.label?'true':undefined}><AdminIcon name={icons[index]}/><span>{shortLabels[index]}</span></Link>)}
 </nav>
 <div className="commerce-sidebar-bottom"><Link href="/" target="_blank" rel="noopener noreferrer" className="commerce-store-link" title="스토어 보기"><AdminIcon name="box"/><span>{full?'스토어 보기 ↗':'스토어'}</span></Link><form action="/api/admin/logout" method="POST" className="commerce-logout"><button aria-label="로그아웃"><AdminIcon name="logout"/>{full&&<span>로그아웃</span>}</button></form></div>
 </aside></>;
}
