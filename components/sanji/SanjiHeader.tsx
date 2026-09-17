"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

function Icon({kind}:{kind:"search"|"cart"|"menu"}) {
 return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='search'?<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>:kind==='cart'?<><path d="M3 3h2l2.2 12h12L21 7H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>:<><path d="M4 7h16M4 12h16M4 17h16"/></>}</svg>;
}
export default function SanjiHeader({base,user,isAdmin,cartCount}:{base:string;user:{nickname:string|null;name:string|null}|null;isAdmin:boolean;cartCount:ReactNode}) {
 const [open,setOpen]=useState(false),path=usePathname();
 useEffect(()=>setOpen(false),[path]);
 const loginClick=(e:React.MouseEvent<HTMLAnchorElement>)=>{if(!user&&!isAdmin){e.preventDefault();window.location.href=`/login?redirect=${encodeURIComponent(window.location.pathname+window.location.search)}`;}};
 const links=[{href:base||'/',label:'산지직송'},{href:base+'/products',label:'전체 상품'},{href:base+'/about',label:'산지픽 이야기'},{href:'/orders/lookup',label:'주문·배송 조회'}];
 return <header className="sj-header" onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>
  <div className="sj-header-inner">
   <Link className="sj-header-brand" href={base||'/'} aria-label="산지픽 홈"><img src="/sanji/logo-wide.png" alt="산지픽 SANJI PICK" width="64" height="58"/><span>산지의 좋은 것,<br/><b>일상의 식탁으로.</b></span></Link>
   <nav className="sj-header-nav" aria-label="주요 메뉴">{links.map(l=><Link key={l.href} href={l.href}>{l.label}</Link>)}</nav>
   <div className="sj-header-actions">
    <Link className="sj-header-account" onClick={loginClick} href={isAdmin?'/admin':user?base+'/mypage':'/login'}>{isAdmin?'관리자':user?'마이페이지':'로그인'}</Link>
    <Link className="sj-header-icon" href={base+'/products'} aria-label="상품 검색"><Icon kind="search"/></Link>
    <Link className="sj-header-icon" href="/cart" aria-label="장바구니"><Icon kind="cart"/>{cartCount}</Link>
    <button type="button" className="sj-header-icon sj-header-menu" aria-label={open?'메뉴 닫기':'메뉴 열기'} aria-expanded={open} aria-controls="sanji-header-menu" onClick={()=>setOpen(v=>!v)}><Icon kind="menu"/></button>
   </div>
  </div>
  {open&&<nav id="sanji-header-menu" className="sj-header-dropdown" aria-label="전체 메뉴">{links.map(l=><Link key={l.href} href={l.href} onClick={()=>setOpen(false)}>{l.label}<span aria-hidden="true">↗</span></Link>)}<Link href={user?base+'/mypage':'/login'} onClick={e=>{setOpen(false);loginClick(e);}}>{user?'마이페이지':'로그인'}<span aria-hidden="true">↗</span></Link></nav>}
 </header>;
}
