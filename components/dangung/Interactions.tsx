'use client';
import { useEffect,useRef } from 'react';
export default function DangungInteractions(){
 const viewer=useRef<HTMLDialogElement>(null),guide=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
 const root=document.querySelector('.dangung')!,stage=root.querySelector<HTMLElement>('#season-stage')!,frames=Array.from(stage.querySelectorAll<HTMLElement>('.season-frame')),picks=Array.from(root.querySelectorAll<HTMLElement>('[data-pick]')),play=root.querySelector<HTMLButtonElement>('#season-play')!,status=root.querySelector<HTMLElement>('#season-status')!;
 const abort=new AbortController(),reduce=matchMedia('(prefers-reduced-motion: reduce)');let timer:ReturnType<typeof setTimeout>|undefined,index=0,paused=false,overview=reduce.matches;
 function render(){clearTimeout(timer);stage.classList.toggle('cinema',!overview);stage.dataset.current=String(index);stage.classList.remove('running');frames.forEach((f,i)=>{f.classList.toggle('active',!overview&&i===index);f.inert=!overview&&i!==index;f.setAttribute('aria-hidden',String(!overview&&i!==index));});picks.forEach((p,i)=>p.setAttribute('aria-pressed',String(!overview&&i===index)));
 const running=!paused&&!overview&&!reduce.matches&&!document.hidden&&!root.querySelector('dialog[open]');play.textContent=reduce.matches?'모션 줄이기 적용':paused||overview?'▶ 자동 재생':'Ⅱ 일시정지';play.disabled=reduce.matches;status.setAttribute('aria-live',running?'off':'polite');status.textContent=overview?'네 계절 함께 보기':`${['봄','여름','가을','겨울'][index]} · ${index+1} / 4${running?' · 자동 반복':' · 일시정지'}`;
 if(running){stage.classList.add('running');timer=setTimeout(()=>{index=(index+1)%4;render();},4000);}}
 function go(){guide.current?.close();root.querySelector<HTMLElement>('#booking')?.scrollIntoView({behavior:reduce.matches?'instant':'smooth',block:'start'});root.querySelector<HTMLElement>('#booking-heading')?.focus({preventScroll:true});}
 root.addEventListener('click',(event)=>{const el=event.target as HTMLElement,photo=el.closest<HTMLElement>('[data-photo]');
 if(photo){const src=photo.querySelector<HTMLImageElement>('img')||root.querySelector<HTMLImageElement>('.hero>img');if(src&&viewer.current){const image=viewer.current.querySelector('img')!;image.src=src.currentSrc||src.src;image.alt=src.alt;viewer.current.querySelector('figcaption')!.textContent=src.alt;viewer.current.showModal();render();}return;}
 const pick=el.closest<HTMLElement>('[data-pick]');if(pick){index=Number(pick.dataset.pick);overview=false;paused=true;render();}
 if(el.closest('#season-play')){paused=overview?false:!paused;overview=false;render();}
 if(el.closest('#season-all')){overview=true;render();}
 if(el.closest('#rooms-prev,#rooms-next'))root.querySelector('#room-gallery')?.scrollBy({left:el.closest('#rooms-prev')?-280:280,behavior:reduce.matches?'instant':'smooth'});
 if(el.closest('[data-open-booking]')){const box=root.querySelector('#booking')!.getBoundingClientRect();if(box.top<window.innerHeight*.65&&box.bottom>0)go();else{guide.current?.showModal();render();}}
 if(el.closest('[data-go-booking]'))go();
 },{signal:abort.signal});
 document.addEventListener('visibilitychange',render,{signal:abort.signal});reduce.addEventListener('change',()=>{overview=reduce.matches;render();},{signal:abort.signal});root.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',render,{signal:abort.signal}));render();return()=>{abort.abort();clearTimeout(timer);};
 },[]);
 return <><dialog ref={viewer} className="dg-viewer" aria-label="사진 전체 보기" onClick={e=>{if(e.target===e.currentTarget)e.currentTarget.close();}}><button className="dialog-close" aria-label="사진 닫기" onClick={()=>viewer.current?.close()}>×</button><figure><img alt=""/><figcaption/></figure></dialog><dialog className="booking-dialog" ref={guide} aria-labelledby="booking-guide-title"><button className="dialog-close" aria-label="예약 안내 닫기" onClick={()=>guide.current?.close()}>×</button><div className="eyebrow">STAY WITH US</div><h2 id="booking-guide-title">함께할 날짜를 골라보세요.</h2><p>페이지 아래 예약 달력에서 날짜·인원을 고르고 결제 금액을 확인할 수 있어요.</p><button className="booking-primary" data-go-booking>예약 달력으로 이동 ↓</button></dialog><div className="booking-dock"><div><span>DANGUNG · PRIVATE STAY</span><strong>우리의 하루를 단궁에서.</strong></div><button className="booking-primary" data-open-booking aria-haspopup="dialog">날짜·요금 확인 ↓</button></div></>;
}
