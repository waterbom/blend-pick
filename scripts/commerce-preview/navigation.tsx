import React,{useEffect,useState} from 'react';
export function navigate(href:string){window.location.hash=encodeURIComponent(href);window.dispatchEvent(new Event('preview-nav'));}
export function usePathname(){const read=()=>decodeURIComponent(window.location.hash.slice(1)||'/admin').split('?')[0];const [path,setPath]=useState(read);useEffect(()=>{const fn=()=>setPath(read());window.addEventListener('hashchange',fn);window.addEventListener('preview-nav',fn);return()=>{window.removeEventListener('hashchange',fn);window.removeEventListener('preview-nav',fn);};},[]);return path;}
export function useRouter(){return {push:navigate,replace:navigate,refresh:()=>{}};}
export function useSearchParams(){return new URLSearchParams();}
export default function Link({href,children,onClick,...props}:any){return <a {...props} href={'#'+encodeURIComponent(String(href))} onClick={e=>{e.preventDefault();onClick?.(e);navigate(String(href));}}>{children}</a>;}
