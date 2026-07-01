import type { Metadata } from "next";
import "./globals.css";
import GlobalFloating from "@/components/GlobalFloating";
import Footer from "@/components/Footer";

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
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Footer />
        <GlobalFloating />
      </body>
    </html>
  );
}
