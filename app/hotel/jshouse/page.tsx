import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentSite } from "@/lib/site-server";
import { stayService } from "@/lib/jshouse-server";
import { DEFAULT_CONFIG, publicConfig } from "@/lib/jshouse-core.cjs";
import { JSH_URL, SPACES, type StayConfig } from "@/components/jshouse/content";
import { Amenities, Closing, Glance, Guide, Header, Hero, Intro, Location, Marquee } from "@/components/jshouse/Sections";
import { BookingSection, MobileBar, StayProvider } from "@/components/jshouse/Booking";
import Tour from "@/components/jshouse/Tour";
import Motion from "@/components/jshouse/Motion";
import "@/components/jshouse/jshouse.css";

// JS하우스(연남동) — 블랜드픽 안의 단독 숙소 예약 페이지. 블랜드픽 공용 헤더 대신 자체 헤더를 쓴다.
// 구성: 커튼 인트로 → 히어로(빠른 예약 바) → 한눈에 보기 → 공간 둘러보기 → 비품 → 위치(약도) → 달력 예약·조회 → 이용 안내 → 맺음
const title = "JS하우스 | 연남동 프라이빗 스테이";
const description = "오크와 화이트로 채운 연남동의 프라이빗 스테이, JS하우스. 침실 2개와 주방·세탁실을 하루 한 팀이 온전히. 달력에서 날짜를 골라 바로 예약을 신청하세요.";
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: JSH_URL },
  openGraph: { title, description, url: JSH_URL, type: "website", locale: "ko_KR", siteName: "JS HOUSE", images: [{ url: "https://shop.blendpunch.com/hotel/jshouse/og.jpg", width: 1200, height: 630, alt: "JS하우스 연남동 프라이빗 스테이" }] },
  twitter: { card: "summary_large_image", title, description, images: ["https://shop.blendpunch.com/hotel/jshouse/og.jpg"] },
};

// 주소·입실 시간 등 운영자가 입력한 공개 설정 — DB를 못 읽어도 페이지는 기본값으로 열린다
async function loadConfig(): Promise<StayConfig> {
  try {
    return publicConfig(await stayService.readConfig()) as StayConfig;
  } catch {
    return publicConfig({ ...DEFAULT_CONFIG }) as StayConfig;
  }
}

export default async function JsHousePage() {
  if ((await currentSite()).key !== "blendpick") notFound();
  const config = await loadConfig();
  const jsonLd = {
    "@context": "https://schema.org", "@type": "LodgingBusiness", name: "JS하우스", alternateName: "JS HOUSE", url: JSH_URL, description,
    image: SPACES.map(s => `https://shop.blendpunch.com${s.photo.src}`),
    address: { "@type": "PostalAddress", addressCountry: "KR", addressRegion: "서울특별시", addressLocality: "마포구 연남동", ...(config.address ? { streetAddress: config.address } : {}) },
    ...(config.checkInTime ? { checkinTime: config.checkInTime } : {}), ...(config.checkOutTime ? { checkoutTime: config.checkOutTime } : {}),
  };
  return <div className="jsh" data-jshouse-version="2026-11-launch-1">
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <Intro />
    <StayProvider initialConfig={config}>
      <Header />
      <main>
        <Hero />
        <Marquee />
        <Glance />
        <Tour />
        <Amenities />
        <Location config={config} />
        <BookingSection />
        <Guide config={config} />
        <Closing />
      </main>
      <MobileBar />
    </StayProvider>
    <Motion />
  </div>;
}
