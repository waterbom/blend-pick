import type { Metadata } from "next";
import { SITES, SANJI } from "@/lib/sites";

const S = SITES.sanjipick;

// 산지픽 공통 메타 — 서브도메인으로 접속하면 proxy.ts가 /sanji/* 로 리라이트해서 이 레이아웃을 탄다
export const metadata: Metadata = {
  title: { default: `${S.name} — ${S.tagline}`, template: `%s · ${S.name}` },
  description: S.description,
  openGraph: {
    title: `${S.name} — ${S.tagline}`,
    description: S.description,
    url: `https://${S.host}`,
    siteName: S.name,
    type: "website",
    locale: "ko_KR",
  },
};

export default function SanjiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: SANJI.cream, minHeight: "100vh" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      {children}
    </div>
  );
}
