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
    title: { default: "농가 직송 제철 농산물 공동구매", template: `%s · ${S.name}` },
    description: "산지에서 바로, 제철 그대로 집 앞까지. 농가 직송·중간유통 ZERO·수확 당일 발송 — 인플루언서가 직접 검증한 농산물 공동구매, 산지픽.",
    alternates: { canonical: path || "/" },
    robots: onSanjiHost ? { index: true, follow: true } : { index: false, follow: false },
    verification: {
      google: S.verification.google.length ? S.verification.google : undefined,
      other: S.verification.naver.length ? { "naver-site-verification": S.verification.naver } : undefined,
    },
    openGraph: {
      title: "농가 직송 제철 농산물 공동구매",
      description: "산지에서 바로, 제철 그대로 집 앞까지. 농가 직송 · 중간유통 ZERO · 수확 당일 발송",
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
    <div style={{ background: "#EFE9DC", minHeight: "100svh" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap"
        rel="stylesheet"
      />
      {children}
    </div>
  );
}
