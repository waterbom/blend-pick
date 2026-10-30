import type { Metadata } from "next";
import { headers } from "next/headers";
import { SITES, siteFromHost } from "@/lib/sites";

const S = SITES.sanjipick;

// 산지픽 공통 메타 — 서브도메인으로 접속하면 proxy.ts가 /sanji/* 로 리라이트해서 이 레이아웃을 탄다.
// shop 도메인의 /sanji/* (미리보기)는 같은 내용이 두 주소에 뜨는 셈이라 검색엔진엔 숨기고(noindex),
// 대표 주소(canonical)는 항상 sanjipick 도메인으로 알려준다. verification 코드는 lib/sites.ts.
export async function generateMetadata(): Promise<Metadata> {
  let onSanjiHost = true;
  let path = "";
  try {
    const h = await headers();
    onSanjiHost = siteFromHost(h.get("host")) === "sanjipick";
    path = (h.get("x-pathname") || "").replace(/^\/sanji(?=\/|$)/, "");
  } catch {
    // 정적 렌더 등 headers() 불가 컨텍스트 — 기본값 유지
  }
  return {
    metadataBase: new URL(`https://${S.host}`),
    title: { default: "제철 농산물·수산물 공동구매 | 산지픽", template: `%s | ${S.name}` },
    description: "산지픽에서 제철 농산물과 수산물 공동구매를 둘러보세요. 상품별 원산지, 중량·구성, 공구 일정과 배송 조건을 비교해 선택할 수 있습니다.",
    alternates: { canonical: path || "/" },
    robots: onSanjiHost ? { index: true, follow: true } : { index: false, follow: false },
    // 탭 아이콘 — 산지픽 로고 (루트 레이아웃의 블랜드픽 아이콘을 덮어씀). 산지픽 도메인의 /favicon.ico 직접 요청은 proxy가 이 파일로 보낸다
    icons: {
      icon: [
        { url: "/sanji/favicon.ico", sizes: "any" },
        { url: "/sanji/icon-512.png", type: "image/png", sizes: "512x512" },
      ],
      apple: "/sanji/apple-icon.png",
    },
    verification: {
      google: S.verification.google.length ? S.verification.google : undefined,
      other: S.verification.naver.length ? { "naver-site-verification": S.verification.naver } : undefined,
    },
    openGraph: {
      title: "제철 농산물·수산물 공동구매 | 산지픽",
      description: "농산물·수산물 공동구매 상품의 원산지와 구성, 가격·배송 조건을 상품별로 확인하세요.",
      url: `https://${S.host}`,
      siteName: S.name,
      type: "website",
      locale: "ko_KR",
      // 카톡·인스타 등 링크 미리보기 이미지 — 로고 (public/sanji/og.png, 1200×630)
      images: [{ url: `https://${S.host}/sanji/og.png`, width: 1200, height: 630, alt: "산지픽 SANJI PICK" }],
    },
    twitter: { card: "summary_large_image", images: [`https://${S.host}/sanji/og.png`] },
  };
}

export default function SanjiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sanji-shell">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </div>
  );
}
