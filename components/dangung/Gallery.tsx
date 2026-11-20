'use client';

import { useState } from 'react';
import { dangungPhotos, photoPath, photoSrcSet } from '@/components/dangung/Photos';

// 첫 화면 — 화면 폭을 채우는 사진 한 장. 자동으로 넘기지 않고, 보는 사람이 화살표로 넘긴다.
// 가로로 긴 사진은 틀을 채우고, 세로·정사각 사진은 잘라내지 않고 전체를 보여 준다.
const pad = (n: number) => String(n).padStart(2, '0');
export default function DangungGallery() {
  const [index, setIndex] = useState(0);
  const photo = dangungPhotos[index];
  const move = (delta: number) => setIndex(value => (value + delta + dangungPhotos.length) % dangungPhotos.length);

  return <section className="dgs-gallery" aria-label="단궁 사진 둘러보기" aria-roledescription="캐러셀">
    <button className="dgs-gallery-main" data-photo={photo.id} data-fit={photo.width / photo.height < 1.3 ? 'contain' : 'cover'} type="button" aria-label={`${photo.label} 사진 크게 보기`}>
      <img src={photoPath(photo.id)} srcSet={photoSrcSet(photo.id)} sizes="100vw" alt={photo.alt} width={photo.width} height={photo.height} fetchPriority="high" decoding="async"/>
    </button>
    <div className="dgs-gallery-bar">
      <p className="dgs-gallery-caption" aria-live="polite"><span>{pad(index + 1)}</span>{photo.label}</p>
      <div className="dgs-gallery-controls">
        <button type="button" onClick={() => move(-1)} aria-label="이전 단궁 사진">←</button>
        <span>{pad(index + 1)} <i>/ {dangungPhotos.length}</i></span>
        <button type="button" onClick={() => move(1)} aria-label="다음 단궁 사진">→</button>
        <button type="button" className="dgs-gallery-all" data-photo={photo.id}>사진 {dangungPhotos.length}장 모두 보기</button>
      </div>
    </div>
  </section>;
}
