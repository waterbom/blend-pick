"use client";

import { useCallback, useState } from "react";
import { imageVisibleRegion } from "@/lib/image-exposure";
import { SANJI_IMAGE_ASPECT_RATIO, SANJI_IMAGE_OBJECT_POSITION } from "@/lib/sanji-image-layout";
import type { SiteKey } from "@/lib/sites";

type Props = {
  images: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  site: SiteKey;
  productName: string;
};

const imageLabel = (index: number) => index === 0 ? "대표 사진" : `서브 사진 ${index}`;

export default function ImageExposurePreview({ images, selectedIndex, onSelect, site, productName }: Props) {
  const photos = images.map((url, index) => ({ url: url.trim(), index })).filter(photo => photo.url);
  const selected = photos.find(photo => photo.index === selectedIndex) ?? photos[0];
  if (!selected) return null;

  return <section className="border-t border-gray-200 pt-5 space-y-3" aria-label="이미지 노출 범위 미리보기">
    <div>
      <h3 className="text-sm font-semibold text-gray-800">이미지 노출 범위</h3>
      <p className="text-xs text-gray-500 mt-1">사진을 올리거나 바꾸면 바로 반영돼요. 저장 전에 제목과 상품이 테두리 안에 들어오는지 확인해주세요.</p>
    </div>
    {photos.length > 1 && <div className="flex flex-wrap gap-2" role="group" aria-label="미리볼 사진 선택">
      {photos.map(photo => <button key={photo.index} type="button" onClick={() => onSelect(photo.index)}
        aria-pressed={photo.index === selected.index}
        className={`min-h-10 border px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9430E] ${photo.index === selected.index ? "border-[#C9430E] bg-orange-50 text-[#a63b0b]" : "border-gray-200 text-gray-600"}`}>
        {imageLabel(photo.index)}
      </button>)}
    </div>}
    <ExposureImage key={`${site}:${selected.index}:${selected.url}`} src={selected.url} site={site}
      alt={`${productName.trim() || "상품"} ${imageLabel(selected.index)}`} />
    <p className="text-xs text-gray-500">{site === "sanjipick"
      ? "산지픽 카드와 상세 상단 슬라이드는 같은 범위를 사용해요. 홈 카드의 왼쪽 위에는 공구 상태 배지가 겹칠 수 있어요. 확대 보기와 긴 상세 사진은 원본 전체가 표시돼요."
      : "블랜드픽 대표 사진은 원본 전체가 표시돼요. 미리보기 크기는 실제 화면 너비에 따라 달라져요."}</p>
  </section>;
}

function ExposureImage({ src, site, alt }: { src: string; site: SiteKey; alt: string }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const readSize = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      setSize({ width: image.naturalWidth, height: image.naturalHeight });
    }
  }, []);
  const region = size && imageVisibleRegion(size.width, size.height, site);
  const sanji = site === "sanjipick";

  return <div className="grid gap-5 sm:grid-cols-2">
    <figure className="min-w-0 space-y-2">
      <figcaption className="text-xs font-semibold text-gray-700">원본과 노출 범위</figcaption>
      <div className="relative border border-gray-200 bg-gray-50" style={{ height: 320 }}>
        <img ref={readSize} src={src} alt={`${alt} 원본`} decoding="async" onLoad={event => readSize(event.currentTarget)}
          onError={() => setFailed(true)} style={{ display: failed ? "none" : "block", width: "100%", height: "100%", objectFit: "contain" }} />
        {size && region && !failed && <svg viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="xMidYMid meet"
          aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none">
          <g fill="#111827" fillOpacity="0.6">
            <rect x="0" y="0" width={size.width} height={region.y} />
            <rect x="0" y={region.y + region.height} width={size.width} height={Math.max(0, size.height - region.y - region.height)} />
            <rect x="0" y={region.y} width={region.x} height={region.height} />
            <rect x={region.x + region.width} y={region.y} width={Math.max(0, size.width - region.x - region.width)} height={region.height} />
          </g>
          <rect x={region.x} y={region.y} width={region.width} height={region.height}
            fill="none" stroke="#C9430E" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>}
        {(!size || failed) && <p className="absolute inset-0 flex items-center justify-center p-5 text-center text-xs text-gray-600 bg-gray-50" role="status">
          {failed ? "사진을 불러오지 못했어요. 파일을 다시 올리거나 이미지 URL을 확인해주세요." : "사진 크기를 확인하고 있어요…"}
        </p>}
      </div>
      {size && !failed && <p className="text-xs text-gray-500">{size.width} × {size.height}px · {sanji ? "주황 테두리 안이 표시되고, 어두운 부분은 잘려요." : "주황 테두리 안의 원본 전체가 표시돼요."}</p>}
    </figure>
    <figure className="min-w-0 space-y-2">
      <figcaption className="text-xs font-semibold text-gray-700">{sanji ? "산지픽 카드·대표 사진 미리보기" : "블랜드픽 대표 사진 미리보기"}</figcaption>
      <div className="overflow-hidden border border-gray-200 bg-gray-50" style={{ width: "100%", maxWidth: 320, aspectRatio: SANJI_IMAGE_ASPECT_RATIO }}>
        {size && !failed && <img src={src} alt={`${alt} 실제 노출 미리보기`} decoding="async"
          style={{ display: "block", width: "100%", height: "100%", objectFit: sanji ? "cover" : "contain", objectPosition: sanji ? SANJI_IMAGE_OBJECT_POSITION : "center" }} />}
      </div>
      <p className="text-xs text-gray-500">{sanji ? "사진 비율을 유지하면서 한 칸을 채운 결과예요." : "사진을 자르지 않고 비율을 유지해 표시해요."}</p>
    </figure>
  </div>;
}
