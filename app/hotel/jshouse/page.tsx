import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentSite } from "@/lib/site-server";
import { stayService } from "@/lib/jshouse-server";
import { DEFAULT_CONFIG, publicConfig } from "@/lib/jshouse-core.cjs";
import { JSH_URL, SPACES, type StayConfig } from "@/components/jshouse/content";
import { Amenities, Closing, Fonts, Glance, Guide, Header, Hero, Intro, Location, Marquee } from "@/components/jshouse/Sections";
import { BookingSection, MobileBar, StayProvider } from "@/components/jshouse/Booking";
import Tour from "@/components/jshouse/Tour";
import Motion from "@/components/jshouse/Motion";
import "@/components/jshouse/jshouse.css";

// JS하우스(연남동) — 블랜드픽 안의 단독 숙소 예약 페이지. 블랜드픽 공용 헤더 대신 자체 헤더를 쓴다.
// 구성: 커튼 인트로 → 히어로(빠른 예약 바) → 한눈에 보기 → 공간 둘러보기 → 비품 → 위치(약도) → 달력 예약·결제·조회 → 이용 안내 → 맺음
// 결제는 블랜드픽과 같은 토스 결제창을 쓰고, 결제 뒤에는 /hotel/jshouse/result 에서 승인·확정한다.
const title = "JS하우스 | 연남동 프라이빗 스테이";
const description = "오크와 화이트로 채운 연남동의 프라이빗 스테이, JS하우스. 침실 2개와 주방·세탁실을 하루 한 팀이 온전히. 달력에서 날짜를 골라 바로 예약하세요.";
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: JSH_URL },
  openGraph: { title, description, url: JSH_URL, type: "website", locale: "ko_KR", siteName: "JS HOUSE", images: [{ url: "https://shop.blendpunch.com/hotel/jshouse/og.jpg", width: 1200, height: 630, alt: "JS하우스 연남동 프라이빗 스테이" }] },
  twitter: { card: "summary_large_image", title, description, images: ["https://shop.blendpunch.com/hotel/jshouse/og.jpg"] },
};

// 주소·입실 시간 등 운영자가 입력한 공개 설정과 카드 결제 여부 — DB를 못 읽어도 페이지는 기본값으로 열린다
async function loadConfig(): Promise<{ config: StayConfig; pay: boolean }> {
  try {
    const stored = await stayService.readConfig();
    return { config: publicConfig(stored) as StayConfig, pay: stayService.payMode(stored) };
  } catch {
    return { config: publicConfig({ ...DEFAULT_CONFIG }) as StayConfig, pay: false };
  }
}

export default async function JsHousePage() {
  if ((await currentSite()).key !== "blendpick") notFound();
  const { config, pay } = await loadConfig();
  const jsonLd = {
    "@context": "https://schema.org", "@type": "LodgingBusiness", name: "JS하우스", alternateName: "JS HOUSE", url: JSH_URL, description,
    image: SPACES.map(s => `https://shop.blendpunch.com${s.photo.src}`),
    address: { "@type": "PostalAddress", addressCountry: "KR", addressRegion: "서울특별시", addressLocality: "마포구 연남동", ...(config.address ? { streetAddress: config.address } : {}) },
    ...(config.checkInTime ? { checkinTime: config.checkInTime } : {}), ...(config.checkOutTime ? { checkoutTime: config.checkOutTime } : {}),
  };
  return <div className="jsh" data-jshouse-version="2026-11-pay-1">
    <Fonts />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <Intro />
    <StayProvider initialConfig={config} initialPay={pay} clientKey={process.env.TOSS_CLIENT_KEY || ""}>
      <Header />
      <main>
        <Hero />
        <Marquee />
        <Glance />
        <Tour />
        <Amenities />
        <Location config={config} />
        <BookingSection />
        <Guide config={config} pay={pay} />
        <Closing />
      </main>
      <MobileBar />
    </StayProvider>
    <Motion />
  </div>;
}
