"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// Compact mobile shopping header. Search, account, cart and existing route behavior remain shared.
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
 const normalized=(path||'/').replace(/^\/sanji(?=\/|$)/,'')||'/';
 const browsing=normalized==='/'||normalized==='/products';
 return <header className={`sj-header${browsing?' sj-header--browse':''}`} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>
  <style>{`.sj-header .sj-wordmark{display:flex;align-items:center;gap:3px;font-size:25px;font-weight:800;letter-spacing:-.08em;line-height:1;color:#C9430E;white-space:nowrap}.sj-wordmark i{display:block;width:5px;height:5px;margin-top:13px;border-radius:50%;background:#C9430E}.sj-header .sj-header-search,.sanji-mobile-shell .sj-header-search{border-radius:6px;background:#f3f3f5}.sj-header--browse .sj-header-actions>a.sj-header-icon{display:none}.sj-header .sj-header-inner,.sanji-mobile-shell .sj-header-inner{height:58px;padding-inline:16px;gap:12px}.sj-header .sj-header-icon,.sanji-mobile-shell .sj-header-icon{width:32px;height:40px}.sj-header .sj-header-search input,.sanji-mobile-shell .sj-header-search input{font-size:12px}.sj-header .sj-header-brand{gap:0}.sj-header .sj-header-dropdown{position:absolute;top:100%;left:0;right:0;background:#fff;border-bottom:1px solid #eee;box-shadow:0 8px 18px #0000000a}.sj-header .sj-header-dropdown a{background:#fff;border-radius:0;font-size:14px;border-bottom:1px solid #f1f1f1}`}</style>
  <div className="sj-header-inner">
   <Link className="sj-header-brand" href={base||'/'} aria-label="산지픽 홈"><strong className="sj-wordmark">산지픽<i aria-hidden="true"/></strong></Link>
   <nav className="sj-header-nav" aria-label="주요 메뉴">{links.map(l=><Link key={l.href} href={l.href} aria-current={here(l.href)?'page':undefined}>{l.label}</Link>)}</nav>
   <form className="sj-header-search" role="search" action={base+'/products'} method="get">
    <Icon kind="search"/>
    <label htmlFor="sj-header-q" className="sr-only">산지픽 상품 검색</label>
    <input id="sj-header-q" name="q" type="search" placeholder="어떤 먹거리를 찾으세요?" enterKeyHint="search" autoComplete="off"/>
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
