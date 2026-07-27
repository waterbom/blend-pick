import type { Metadata } from "next";
import "./globals.css";
import GlobalFloating from "@/components/GlobalFloating";
import Footer from "@/components/Footer";
import InfRefCookie from "@/components/InfRefCookie";

export const metadata: Metadata = {
  title: "BLEND PICK — 인플루언서 공구 플랫폼",
  description: "블렌드픽에서 트렌디한 제품을 만나보세요",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
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
      </head>
      <body className="min-h-full flex flex-col">
        <InfRefCookie />
        {children}
        <Footer />
        <GlobalFloating />
      </body>
    </html>
  );
}
