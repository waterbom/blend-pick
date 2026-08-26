import Link from "next/link";
import Header from "@/components/Header";

const KAKAO_CHANNEL_URL = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL || "http://pf.kakao.com/_VyING/chat";

const SERIF = "'Noto Serif KR', serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const C = {
  green900: "#1C2418",
  green800: "#244B1F",
  sage: "#7A8B6F",
  surfaceSoft: "#F6F4EE",
  hairline: "#E4E1D6",
  muted: "#6B7263",
  sky: "#BFE3F5",
  skyDeep: "#7EB8DA",
  grass: "#7FB98B",
} as const;

export const metadata = {
  title: "단궁 X 블랜드픽 — 펜션 공동구매 오픈 준비 중 · BLEND PICK",
  description: "한옥과 넓은 잔디 정원 — 독채 & 파티룸 펜션 공구. 오픈 소식을 가장 먼저 받아보세요.",
  openGraph: {
    title: "단궁 X 블랜드픽 — 펜션 공동구매 오픈 준비 중 · BLEND PICK",
    description: "한옥과 넓은 잔디 정원 — 독채 & 파티룸 펜션 공구.",
    url: "https://shop.blendpunch.com/hotel/dangung",
    siteName: "BLEND PICK",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "https://shop.blendpunch.com/hotel/dangung-hero.jpg", width: 1224, height: 968, alt: "단궁 펜션 한옥과 잔디 정원" }],
  },
};

// 단궁 펜션 공구 — 히어로(사진 + 페이드인 타이틀) 티저.
// 상세(달력·요금·예약)는 공구 일정 확정 후 이 페이지에 섹션으로 붙는다.
export default function DangungTeaserPage() {
  return (
    <main className="min-h-screen" style={{ background: "#FFFFFF" }}>
      {/* 딥 포레스트 전용 폰트 (utop과 동일 톤) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <Header />

      <style>{`
        /* 히어로 타이틀 — 천천히 떠오르는 페이드인 (줄마다 시차) */
        @keyframes dg-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dg-fade { opacity: 0; animation: dg-fade-up 1.6s cubic-bezier(.22,.61,.36,1) forwards; }
        .dg-d1 { animation-delay: .25s; }
        .dg-d2 { animation-delay: .75s; animation-duration: 2s; }
        .dg-d3 { animation-delay: 1.5s; }
        /* 스크롤 리빌 — 섹션이 화면에 들어오며 스르륵 (미지원 브라우저는 그냥 표시) */
        @keyframes dg-rise {
          from { opacity: 0; transform: translateY(36px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @supports (animation-timeline: view()) {
          .dg-reveal {
            animation: dg-rise both ease-out;
            animation-timeline: view();
            animation-range: entry 0% entry 55%;
          }
        }
        /* 모션 최소화 설정 존중 */
        @media (prefers-reduced-motion: reduce) {
          .dg-fade, .dg-reveal { animation: none; opacity: 1; transform: none; }
        }
      `}</style>

      {/* ── 히어로 — 한옥 정원 사진 + 페이드인 타이틀 ── */}
      <section className="relative overflow-hidden" style={{ height: "min(78vh, 720px)", minHeight: 460 }}>
        {/* 사진 (없으면 하늘→잔디 그라데이션이 대신 보임) */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: `url(/hotel/dangung-hero.jpg), linear-gradient(180deg, ${C.sky} 0%, ${C.skyDeep} 46%, ${C.grass} 100%)`,
            backgroundSize: "cover",
            backgroundPosition: "center 62%",
          }} />
        {/* 텍스트 가독용 얇은 베일 — 사진의 하늘 톤을 해치지 않게 아주 옅게 */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(10,30,50,.22) 0%, rgba(10,30,50,.05) 40%, rgba(16,38,24,.30) 100%)" }} />

        <div className="relative h-full flex flex-col items-center justify-center text-center px-5">
          <div className="dg-fade dg-d1 text-[10px] lg:text-[12px] mb-4 lg:mb-5"
            style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".34em", color: "rgba(255,255,255,.92)" }}>
            PENSION · 공동구매
          </div>
          <h1 className="dg-fade dg-d2 m-0 text-[38px] lg:text-[72px] leading-[1.15]"
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              // 사진의 하늘·잔디에서 딴 하늘색 → 초록 그라데이션 타이포
              backgroundImage: "linear-gradient(115deg, #EAF6FF 0%, #BFE3F5 34%, #D9F0DC 62%, #9ED0A8 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: "drop-shadow(0 2px 14px rgba(12,36,52,.45))",
            }}>
            단궁 <span style={{ fontWeight: 400 }}>X</span> 블랜드픽
          </h1>
          <p className="dg-fade dg-d3 mt-4 lg:mt-5 text-[13.5px] lg:text-[16px]"
            style={{ color: "rgba(255,255,255,.9)", textShadow: "0 1px 10px rgba(12,36,52,.4)" }}>
            한옥과 넓은 잔디 정원 — 독채 & 파티룸 공동구매
          </p>
        </div>
      </section>

      <div className="max-w-[840px] mx-auto px-5 lg:px-8 py-12 lg:py-16 text-center">
        {/* COMING SOON 밴드 */}
        <div className="dg-reveal flex flex-col items-center justify-center gap-2.5 py-14 lg:py-16"
          style={{ border: `1px solid ${C.hairline}`, background: `repeating-linear-gradient(45deg,#FFFFFF,#FFFFFF 12px,${C.surfaceSoft} 12px,${C.surfaceSoft} 24px)` }}>
          <span className="text-[10px]" style={{ fontFamily: MONO, color: C.sage, letterSpacing: ".28em" }}>COMING SOON</span>
          <span className="text-[18px] lg:text-[22px] font-semibold" style={{ fontFamily: SERIF, color: C.green900 }}>
            공구 오픈 준비 중입니다
          </span>
          <span className="text-[12.5px] lg:text-[13px]" style={{ color: C.muted }}>
            일정과 가격은 오픈과 함께 공개돼요
          </span>
        </div>

        {/* 확정된 구성 미리보기 */}
        <div className="dg-reveal mt-8 grid grid-cols-2 lg:grid-cols-4 gap-[1px]" style={{ background: C.hairline, border: `1px solid ${C.hairline}` }}>
          {[
            ["독채 펜션", "기준 15인 · 최대 24인"],
            ["파티룸", "구성 공개 예정"],
            ["바베큐", "비가림막 완비 · 우천 OK"],
            ["넓은 정원", "촬영 대여 패키지 예정"],
          ].map(([t, d]) => (
            <div key={t} className="bg-white px-4 py-5">
              <div className="text-[13px] lg:text-[14px] font-bold" style={{ color: C.green900 }}>{t}</div>
              <div className="text-[11.5px] lg:text-[12px] mt-1" style={{ color: C.muted }}>{d}</div>
            </div>
          ))}
        </div>

        {/* 오픈 알림 + 돌아가기 */}
        <div className="dg-reveal mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer"
            className="inline-block text-[13px] font-bold px-7 py-3.5"
            style={{ background: "#FEE500", color: "#191600" }}>
            💬 카카오톡 채널에서 오픈 알림 받기
          </a>
          <Link href="/hotel" className="inline-block text-[13px] font-bold px-7 py-3.5"
            style={{ border: `1px solid ${C.hairline}`, color: C.muted }}>
            ← 숙박공구 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}
