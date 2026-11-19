import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentSite } from "@/lib/site-server";
import { stayService } from "@/lib/limen-server";
import { DEFAULT_CONFIG, publicConfig } from "@/lib/limen-core.cjs";
import { BRAND, LIMEN_URL, ROOMS, ROOM_KEYS, SPACES, type StayConfig } from "@/components/limen/content";
import { Amenities, Closing, Definition, Guide, Header, Hero, Intro, Location, Passage, Rooms, Story, Values } from "@/components/limen/Sections";
import { BookingSection, MobileBar, StayProvider } from "@/components/limen/Booking";
import Tour from "@/components/limen/Tour";
import Motion from "@/components/limen/Motion";
// 서체는 Pretendard 한 가지 — 사이트에 내장한 분할 글꼴이라 화면에 쓰인 글자 묶음만 내려받는다
import "@/components/limen/fonts/pretendard.css";
import "@/components/limen/limen.css";

// LIMEN(리멘 · 연남동) — 블랜드픽 안의 단독 숙소 예약 페이지. 블랜드픽 공용 헤더 대신 자체 헤더를 쓴다.
// 구성: 문이 열리는 인트로 → 히어로 → 01 브랜드 정의 → 문을 지나는 장면 → 02 스토리 → 03 가치 → 04 객실·요금
//       → 05 공간 둘러보기·비품 → 06 위치 → 07 달력 예약·결제·조회 → 08 이용 안내 → 맺음
// 결제는 블랜드픽과 같은 토스 결제창을 쓰고, 결제 뒤에는 /hotel/limen/result 에서 승인·확정한다.
const title = "LIMEN 리멘 | 연남동 프라이빗 스테이";
const description = "경계를 넘어, 고요함 속으로. 홍대와 연남동 한가운데, 문 하나를 경계로 전혀 다른 고요가 펼쳐지는 프라이빗 스테이 LIMEN. 원룸(2인)·투룸(4인), 달력에서 날짜를 골라 바로 예약하세요.";
const ogImage = "https://shop.blendpunch.com/hotel/limen/og.jpg";
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: LIMEN_URL },
  openGraph: { title, description, url: LIMEN_URL, type: "website", locale: "ko_KR", siteName: "LIMEN", images: [{ url: ogImage, width: 1200, height: 630, alt: "LIMEN 리멘 — 연남동 프라이빗 스테이" }] },
  twitter: { card: "summary_large_image", title, description, images: [ogImage] },
};

// 요금·주소·입실 시간 등 운영자가 입력한 공개 설정과 카드 결제 여부 — DB를 못 읽어도 페이지는 기본값(숙소가 보낸 요금표)으로 열린다
async function loadConfig(): Promise<{ config: StayConfig; pay: boolean }> {
  try {
    const stored = await stayService.readConfig();
    return { config: publicConfig(stored) as StayConfig, pay: stayService.payMode(stored) };
  } catch {
    return { config: publicConfig({ ...DEFAULT_CONFIG }) as StayConfig, pay: false };
  }
}

export default async function LimenPage() {
  if ((await currentSite()).key !== "blendpick") notFound();
  const { config, pay } = await loadConfig();
  const prices = ROOM_KEYS.flatMap(key => [config.rooms[key].weekday, config.rooms[key].friday, config.rooms[key].saturday, config.rooms[key].shoulder, config.rooms[key].peak]).filter((v): v is number => typeof v === "number");
  const jsonLd = {
    "@context": "https://schema.org", "@type": "LodgingBusiness", name: "LIMEN", alternateName: "리멘", slogan: BRAND.tagline, url: LIMEN_URL, description,
    image: SPACES.map(s => `https://shop.blendpunch.com${s.photo.src}`),
    address: { "@type": "PostalAddress", addressCountry: "KR", addressRegion: "서울특별시", addressLocality: "마포구 연남동", ...(config.address ? { streetAddress: config.address } : {}) },
    ...(prices.length ? { priceRange: `₩${Math.min(...prices).toLocaleString("ko-KR")}–₩${Math.max(...prices).toLocaleString("ko-KR")}` } : {}),
    containsPlace: ROOM_KEYS.map(key => ({ "@type": "Accommodation", name: `LIMEN ${ROOMS[key].name}`, occupancy: { "@type": "QuantitativeValue", maxValue: config.rooms[key].guests } })),
    ...(config.checkInTime ? { checkinTime: config.checkInTime } : {}), ...(config.checkOutTime ? { checkoutTime: config.checkOutTime } : {}),
  };
  return <div className="lm" data-limen-version="2026-11-brand-1">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <Intro />
    <StayProvider initialConfig={config} initialPay={pay} clientKey={process.env.TOSS_CLIENT_KEY || ""}>
      <Header />
      <main>
        <Hero />
        <Definition />
        <Passage />
        <Story />
        <Values />
        <Rooms config={config} />
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
