import type { Metadata } from "next";
import { SITES } from "@/lib/sites";

const S = SITES.sanjipick;

// 산지픽 공통 메타 — 서브도메인으로 접속하면 proxy.ts가 /sanji/* 로 리라이트해서 이 레이아웃을 탄다
export const metadata: Metadata = {
  title: { default: `${S.name} — 농가 직송 제철 농산물 공동구매`, template: `%s · ${S.name}` },
  description: "산지에서 바로, 제철 그대로 집 앞까지. 농가 직송·중간유통 ZERO·수확 당일 발송 — 인플루언서가 직접 검증한 농산물 공동구매, 산지픽.",
  openGraph: {
    title: `${S.name} — 농가 직송 제철 농산물 공동구매`,
    description: "산지에서 바로, 제철 그대로 집 앞까지. 농가 직송 · 중간유통 ZERO · 수확 당일 발송",
    url: `https://${S.host}`,
    siteName: S.name,
    type: "website",
    locale: "ko_KR",
    images: [{ url: `https://${S.host}/sanji/hero-farmer.png`, width: 784, height: 552, alt: "산지픽 — 농가 직송 제철 농산물" }],
  },
};

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
