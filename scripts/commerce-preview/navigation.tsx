import React,{useEffect,useState} from 'react';
function current(){try{return decodeURIComponent(window.location.hash.slice(1))||'/admin';}catch{return '/admin';}}
function useHref(){const [href,setHref]=useState(current);useEffect(()=>{const update=()=>setHref(current());window.addEventListener('hashchange',update);window.addEventListener('preview-nav',update);return()=>{window.removeEventListener('hashchange',update);window.removeEventListener('preview-nav',update);};},[]);return href;}
export function navigate(href:string){
 const next=new URL(href,new URL(current(),'https://preview.invalid'));
 const value=next.pathname+next.search+next.hash;
 window.location.hash=encodeURIComponent(value);window.dispatchEvent(new Event('preview-nav'));
 if(next.hash)setTimeout(()=>document.getElementById(next.hash.slice(1))?.scrollIntoView({block:'start'}),40);
}
export function usePathname(){return new URL(useHref(),'https://preview.invalid').pathname;}
export function useSearchParams(){return new URL(useHref(),'https://preview.invalid').searchParams;}
export function useRouter(){return {push:navigate,replace:navigate,refresh:()=>window.dispatchEvent(new Event('preview-nav'))};}
export default function Link({href,children,onClick,prefetch,...props}:any){return <a {...props} href={'#'+encodeURIComponent(String(href))} onClick={e=>{e.preventDefault();onClick?.(e);navigate(String(href));}}>{children}</a>;}
