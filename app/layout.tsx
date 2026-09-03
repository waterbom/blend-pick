import type { Metadata } from "next";
import "./globals.css";
import GlobalFloating from "@/components/GlobalFloating";
import Footer from "@/components/Footer";
import InfRefCookie from "@/components/InfRefCookie";
import { SiteProvider } from "@/components/SiteContext";
import { currentSite } from "@/lib/site-server";

export const metadata: Metadata = {
  title: "BLEND PICK — 인플루언서 공구 플랫폼",
  description: "블랜드픽에서 트렌디한 제품을 만나보세요",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 사이트(블랜드픽/산지픽) 판별 — html[data-site]로 globals.css 팔레트가 갈리고, 클라이언트는 SiteProvider로 받는다
  const site = await currentSite();
  return (
    <html lang="ko" className="h-full antialiased" data-site={site.key}>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@1.0.3/packages/wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.min.css"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
        {site.key === "sanjipick" && (
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" />
        )}
      </head>
      <body className="min-h-full flex flex-col">
        <SiteProvider site={site.key}>
          <InfRefCookie />
          {children}
          <Footer />
          <GlobalFloating />
        </SiteProvider>
      </body>
    </html>
  );
}
