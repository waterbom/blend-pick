'use client';

import { useEffect, useRef, useState } from 'react';
import { getPhoto, photoPath } from '@/components/dangung/Photos';

const roomPhotos = [7, 8, 9, 11, 12, 10, 13, 14].map(getPhoto);
// The repeated first frame lets the last photograph slide forward into the first.
const frames = [...roomPhotos, roomPhotos[0]];

export default function RoomSlideshow({ compact = false }: { compact?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [paused, setPaused] = useState(false);
  const photo = roomPhotos[index % roomPhotos.length];

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      setReducedMotion(media.matches);
      if (media.matches) setIndex(value => value % roomPhotos.length);
    };
    updateMotion();
    media.addEventListener('change', updateMotion);
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting && entry.intersectionRatio >= 0.15);
    }, { threshold: [0, 0.15] }) : null;
    if (observer && root.current) observer.observe(root.current);
    else setInView(true);
    return () => { observer?.disconnect(); media.removeEventListener('change', updateMotion); };
  }, []);

  useEffect(() => {
    if (!inView || reducedMotion || paused) return;
    const timer = window.setInterval(() => {
      if (document.hidden || root.current?.matches(':hover, :focus-within') || document.querySelector('.dg-stay-page dialog[open]')) return;
      setIndex(value => {
        const next = (value % roomPhotos.length) + 1;
        const image = root.current?.querySelectorAll<HTMLImageElement>('.dgs-room-slideshow-track img')[next];
        return image?.complete && image.naturalWidth > 0 ? next : value;
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [inView, reducedMotion, paused]);

  return <div ref={root} className={`dgs-room-slideshow${compact ? ' dgs-room-slideshow-compact' : ''}`} role="group" aria-roledescription="슬라이드" aria-label="단궁 객실 사진">
    <button type="button" className="dgs-room-slideshow-open" data-photo={photo.id} aria-label={`${photo.label} 사진 크게 보기`}>
      <span className="dgs-room-slideshow-track"
        style={{ transform: `translateX(-${index * 100}%)`, transition: index === 0 ? 'none' : undefined }}
        onTransitionEnd={event => {
          if (event.target === event.currentTarget && event.propertyName === 'transform' && index === roomPhotos.length) setIndex(0);
        }}>
        {frames.map((frame, position) => <img key={position} src={photoPath(frame.id)} alt="" aria-hidden="true" width={frame.width} height={frame.height} loading={inView ? 'eager' : 'lazy'} decoding="async"/>)}
      </span>
      {!compact && <span className="dgs-room-slideshow-caption" aria-hidden="true">{photo.label}<span>{index % roomPhotos.length + 1} / {roomPhotos.length}</span></span>}
    </button>
    {!reducedMotion && <button type="button" className="dgs-room-slideshow-pause" onClick={() => setPaused(value => !value)} aria-label={`객실 사진 자동 전환 ${paused ? '재생' : '일시정지'}`} title={paused ? '자동 전환 재생' : '자동 전환 일시정지'}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">{paused ? <path d="M4 2.5 13 8 4 13.5Z" fill="currentColor"/> : <path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="3"/>}</svg>
    </button>}
  </div>;
}
