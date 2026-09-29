"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// 산지픽 공통 헤더 (B안) — 로고 · 메뉴(데스크톱) · 검색 알약 · 계정 · 장바구니 · 메뉴 버튼(모바일)
// 검색은 전체 상품 페이지(/products?q=)로 보낸다. 높이 64px(모바일 58px) — 아래 sticky 요소들이 이 높이에 맞춰 붙는다.
function Icon({kind}:{kind:"search"|"cart"|"menu"}) {
 return <svg width={kind==='search'?17:22} height={kind==='search'?17:22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={kind==='search'?2:1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='search'?<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>:kind==='cart'?<><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.6l2.4 12.2h11.4l2.1-8.7H6.2"/></>:<><path d="M4 7h16M4 12h16M4 17h16"/></>}</svg>;
}
export default function SanjiHeader({base,user,isAdmin,cartCount}:{base:string;user:{nickname:string|null;name:string|null}|null;isAdmin:boolean;cartCount:ReactNode}) {
 // 메뉴는 연 경로에서만 열린 상태로 본다 — 페이지를 옮기면 자동으로 닫힘
 const path=usePathname(),[openAt,setOpenAt]=useState<string|null>(null),open=openAt===path;
 const setOpen=(v:boolean|((o:boolean)=>boolean))=>setOpenAt(typeof v==='function'?(v(open)?path:null):(v?path:null));
 const loginClick=(e:React.MouseEvent<HTMLAnchorElement>)=>{if(!user&&!isAdmin){e.preventDefault();window.location.href=`/login?redirect=${encodeURIComponent(window.location.pathname+window.location.search)}`;}};
 const links=[{href:base||'/',label:'진행 중 공구'},{href:base+'/products',label:'전체 상품'},{href:base+'/about',label:'산지 이야기'},{href:'/orders/lookup',label:'주문·배송 조회'}];
 // 현재 위치 표시 — 홈은 정확히 일치할 때만, 나머지는 하위 경로까지
 const here=(href:string)=>{const p=(path||'/').replace(/^\/sanji(?=\/|$)/,'')||'/',h=href.replace(/^\/sanji(?=\/|$)/,'')||'/';return h==='/'?p==='/':p===h||p.startsWith(h+'/');};
 return <header className="sj-header" onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>
  <div className="sj-header-inner">
   <Link className="sj-header-brand" href={base||'/'} aria-label="산지픽 홈"><img src="/sanji/logo-wide.png" alt="산지픽 SANJI PICK" width="51" height="46"/><span>산지의 좋은 것,<br/><b>일상의 식탁으로.</b></span></Link>
   <nav className="sj-header-nav" aria-label="주요 메뉴">{links.map(l=><Link key={l.href} href={l.href} aria-current={here(l.href)?'page':undefined}>{l.label}</Link>)}</nav>
   <form className="sj-header-search" role="search" action={base+'/products'} method="get">
    <Icon kind="search"/>
    <label htmlFor="sj-header-q" className="sr-only">산지픽 상품 검색</label>
    <input id="sj-header-q" name="q" type="search" placeholder="제철 공구 찾기" enterKeyHint="search" autoComplete="off"/>
   </form>
   <div className="sj-header-actions">
    <Link className="sj-header-account" onClick={loginClick} href={isAdmin?'/admin':user?base+'/mypage':'/login'}>{isAdmin?'관리자':user?'마이페이지':'로그인'}</Link>
    <Link className="sj-header-icon" href="/cart" aria-label="장바구니"><Icon kind="cart"/>{cartCount}</Link>
    <button type="button" className="sj-header-icon sj-header-menu" aria-label={open?'메뉴 닫기':'메뉴 열기'} aria-expanded={open} aria-controls="sanji-header-menu" onClick={()=>setOpen(v=>!v)}><Icon kind="menu"/></button>
   </div>
  </div>
  {open&&<nav id="sanji-header-menu" className="sj-header-dropdown" aria-label="전체 메뉴">{links.map(l=><Link key={l.href} href={l.href} aria-current={here(l.href)?'page':undefined} onClick={()=>setOpen(false)}>{l.label}<span aria-hidden="true">›</span></Link>)}<Link href={user?base+'/mypage':'/login'} onClick={e=>{setOpen(false);loginClick(e);}}>{user?'마이페이지':'로그인'}<span aria-hidden="true">›</span></Link></nav>}
 </header>;
}
