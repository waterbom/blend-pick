'use client';

import { useEffect, useRef, useState } from 'react';
import { StayRate } from '@/components/dangung/Availability';
import { dangungPhotos, photoPath } from '@/components/dangung/Photos';

export default function DangungInteractions() {
  const viewer = useRef<HTMLDialogElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const photo = photoIndex === null ? null : dangungPhotos[photoIndex];
  const move = (delta: number) => setPhotoIndex(index => index === null ? null : (index + delta + dangungPhotos.length) % dangungPhotos.length);

  useEffect(() => {
    if (photoIndex !== null && viewer.current && !viewer.current.open) viewer.current.showModal();
  }, [photoIndex]);

  useEffect(() => {
    const root = document.querySelector('.dg-stay-page');
    if (!root) return;
    const abort = new AbortController();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    root.addEventListener('click', event => {
      const target = event.target as Element;
      const selected = target.closest<HTMLElement>('[data-photo]');
      if (selected) {
        const index = dangungPhotos.findIndex(item => item.id === Number(selected.dataset.photo));
        if (index !== -1) { opener.current = selected; setPhotoIndex(index); }
        return;
      }
      if (target.closest('#rooms-prev,#rooms-next')) {
        const gallery = root.querySelector('#room-gallery');
        gallery?.scrollBy({ left: (target.closest('#rooms-prev') ? -1 : 1) * (gallery.clientWidth * .75), behavior: reduce.matches ? 'instant' : 'smooth' });
      }
      if (target.closest('[data-open-booking],a[href="#booking"]')) {
        event.preventDefault();
        root.querySelector('#booking')?.scrollIntoView({ behavior: reduce.matches ? 'instant' : 'smooth', block: 'start' });
        root.querySelector<HTMLElement>('#booking-heading')?.focus({ preventScroll: true });
      }
    }, { signal: abort.signal });

    const booking = root.querySelector('#booking');
    const observer = new IntersectionObserver(entries => {
      if (dock.current) dock.current.hidden = entries.some(entry => entry.isIntersecting);
    }, { threshold: .15 });
    if (booking) observer.observe(booking);

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('.dgs-nav a'));
    const sections = links.map(link => root.querySelector(link.hash));
    let frame = 0;
    const updateNavigation = () => {
      frame = 0;
      const nav = root.querySelector('.dgs-nav');
      const threshold = (nav?.getBoundingClientRect().bottom ?? 150) + 60;
      let active = 0;
      sections.forEach((section, index) => { if (section && section.getBoundingClientRect().top <= threshold) active = index; });
      links.forEach((link, index) => { if (index === active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(updateNavigation); };
    window.addEventListener('scroll', schedule, { passive: true, signal: abort.signal });
    window.addEventListener('resize', schedule, { signal: abort.signal });
    updateNavigation();
    return () => { abort.abort(); observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  return <>
    <dialog ref={viewer} className="dgs-gallery-dialog" aria-label="단궁 사진 전체 보기"
      onClose={() => { setPhotoIndex(null); opener.current?.focus({ preventScroll: true }); }}
      onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); } }}>
      <div className="dgs-viewer-heading"><span>단궁 <small>DANGUNG</small></span><button type="button" autoFocus aria-label="사진 전체 보기 닫기" onClick={() => viewer.current?.close()}>×</button></div>
      {photo && <>
        <figure><img src={photoPath(photo.id)} alt={photo.alt} width={photo.width} height={photo.height}/><figcaption aria-live="polite">{photo.label} <span>{String((photoIndex ?? 0) + 1).padStart(2, '0')} / {dangungPhotos.length}</span></figcaption></figure>
        <div className="dgs-viewer-navigation"><button type="button" onClick={() => move(-1)} aria-label="이전 사진">←</button><div className="dgs-viewer-thumbnails" aria-label="사진 선택">{dangungPhotos.map((item, index) => <button key={item.id} type="button" aria-label={`${item.label} 사진 보기`} aria-pressed={photoIndex === index} onClick={() => setPhotoIndex(index)}><img src={photoPath(item.id)} alt="" width={72} height={52} loading="lazy"/></button>)}</div><button type="button" onClick={() => move(1)} aria-label="다음 사진">→</button></div>
      </>}
    </dialog>
    <div ref={dock} className="booking-dock" hidden><StayRate compact/><button type="button" className="booking-primary" data-open-booking>객실 선택</button></div>
  </>;
}
