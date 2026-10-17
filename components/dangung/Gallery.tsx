'use client';

import { useState } from 'react';
import { dangungPhotos, photoPath } from '@/components/dangung/Photos';

// A manual gallery keeps the architectural photography still while reading.
export default function DangungGallery() {
  const [index, setIndex] = useState(0);
  const photo = dangungPhotos[index];
  const next = dangungPhotos[(index + 16) % dangungPhotos.length];
  const move = (delta: number) => setIndex(value => (value + delta + dangungPhotos.length) % dangungPhotos.length);

  return <section className="dgs-gallery" aria-label="단궁 사진 둘러보기" aria-roledescription="캐러셀">
    <div className="dgs-gallery-frames">
      <button className="dgs-gallery-main" data-photo={photo.id} type="button" aria-label={`${photo.label} 사진 크게 보기`}>
        <img src={photoPath(photo.id)} alt={photo.alt} width={photo.width} height={photo.height} fetchPriority="high" decoding="async"/>
      </button>
      <button className="dgs-gallery-side" data-photo={next.id} type="button" aria-label={`${next.label} 사진 크게 보기`}>
        <img src={photoPath(next.id)} alt={next.alt} width={next.width} height={next.height} decoding="async"/>
      </button>
    </div>
    <div className="dgs-gallery-controls">
      <button type="button" onClick={() => move(-1)} aria-label="이전 단궁 사진">←</button>
      <span aria-live="polite">{String(index + 1).padStart(2, '0')} <i>/ {dangungPhotos.length}</i></span>
      <button type="button" onClick={() => move(1)} aria-label="다음 단궁 사진">→</button>
      <button type="button" className="dgs-gallery-all" data-photo={photo.id}>사진 전체 보기 <span aria-hidden="true">＋</span></button>
    </div>
  </section>;
}
