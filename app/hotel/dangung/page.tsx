import Link from "next/link";
import Header from "@/components/Header";
import DangungHeroBanner from "@/components/DangungHeroBanner";

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

// 이미지·콘텐츠 자리 표시 — 내용 확정되면 실제 사진/텍스트로 교체
function Ph({ h = 200, label = "IMAGE" }: { h?: number; label?: string }) {
  return (
    <div className="flex items-center justify-center w-full"
      style={{
        height: h,
        background: `repeating-linear-gradient(45deg,#FFFFFF,#FFFFFF 12px,${C.surfaceSoft} 12px,${C.surfaceSoft} 24px)`,
        border: `1px solid ${C.hairline}`,
      }}>
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".22em", color: C.sage }}>{label}</span>
    </div>
  );
}

// 섹션 공통 헤더 — 번호 캡션(모노) + 세리프 타이틀 + 리드 문구
function SectionHead({ no, cap, title, lead }: { no: string; cap: string; title: string; lead?: string }) {
  return (
    <div className="text-center mb-7 lg:mb-9">
      <div className="text-[10px] lg:text-[11px] mb-2.5"
        style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".3em", color: C.sage }}>
        {no} — {cap}
      </div>
      <h2 className="m-0 text-[22px] lg:text-[30px]" style={{ fontFamily: SERIF, fontWeight: 600, color: C.green900 }}>
        {title}
      </h2>
      {lead && <p className="mt-2.5 mb-0 text-[13px] lg:text-[14px]" style={{ color: C.muted }}>{lead}</p>}
    </div>
  );
}

// 단궁 펜션 공구 — 히어로(사진 + 페이드인 타이틀) 티저.
// 아래 섹션들은 스켈레톤 — 내용 확정되는 대로 채운다. (달력·요금·예약은 공구 일정 확정 후)
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
        /* 히어로 — 진입 시 화면 꽉 차게 (뷰포트 − 스티키 헤더 높이).
           svh: 모바일 주소창이 늘었다 줄어도 첫 화면 기준으로 안정 */
        .dg-hero { height: calc(100vh - 56px); min-height: 460px; }
        @supports (height: 100svh) { .dg-hero { height: calc(100svh - 56px); } }
        @media (min-width: 640px) {
          .dg-hero { height: calc(100vh - 64px); }
          @supports (height: 100svh) { .dg-hero { height: calc(100svh - 64px); } }
        }
      `}</style>

      {/* ── 히어로 — /hotel 방식의 풀블리드 슬라이드 배너 (사진 분할 + 문구) ── */}
      <DangungHeroBanner />

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

        {/* ── 01 소개 ── */}
        <section id="about" className="dg-reveal mt-16 lg:mt-24">
          <SectionHead no="01" cap="ABOUT" title="단궁 이야기" lead="한옥과 잔디 정원이 있는 공간 — 소개 글이 들어갈 자리예요" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
            <Ph h={260} label="PHOTO — 전경" />
            <div className="text-left px-1 lg:px-4">
              {[92, 100, 84, 96, 70].map((w, i) => (
                <div key={i} className="mb-3 rounded-sm" style={{ height: 12, width: `${w}%`, background: C.surfaceSoft }} />
              ))}
              <div className="mt-4 text-[11px]" style={{ fontFamily: MONO, letterSpacing: ".18em", color: C.sage }}>TEXT — 준비 중</div>
            </div>
          </div>
        </section>

        {/* ── 02 독채 펜션 ── */}
        <section id="stay" className="dg-reveal mt-16 lg:mt-24">
          <SectionHead no="02" cap="PRIVATE STAY" title="독채 펜션" lead="기준 15인 · 최대 24인 — 객실·거실·마당 사진이 들어갈 자리예요" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Ph h={170} label="PHOTO — 거실" />
            <Ph h={170} label="PHOTO — 침실" />
            <div className="col-span-2 lg:col-span-1"><Ph h={170} label="PHOTO — 마당" /></div>
          </div>
        </section>

        {/* ── 03 파티룸 ── */}
        <section id="party" className="dg-reveal mt-16 lg:mt-24">
          <SectionHead no="03" cap="PARTY ROOM" title="파티룸" lead="구성·수용 인원 공개 예정" />
          <Ph h={240} label="PHOTO — 파티룸" />
        </section>

        {/* ── 04 바베큐 & 정원 ── */}
        <section id="outdoor" className="dg-reveal mt-16 lg:mt-24">
          <SectionHead no="04" cap="OUTDOOR" title="바베큐 & 넓은 정원" lead="비가림막 완비 — 우천에도 바베큐 가능 · 정원 촬영 대여 패키지 예정" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Ph h={200} label="PHOTO — 바베큐존" />
            <Ph h={200} label="PHOTO — 정원" />
          </div>
        </section>

        {/* ── 05 요금 안내 ── */}
        <section id="pricing" className="dg-reveal mt-16 lg:mt-24">
          <SectionHead no="05" cap="PRICING" title="요금 안내" lead="공구 오픈과 함께 공개돼요" />
          <div style={{ border: `1px solid ${C.hairline}` }}>
            {["주중 (일–목)", "주말 · 공휴일", "성수기", "인원 추가"].map((label, i) => (
              <div key={label} className="flex items-center justify-between px-5 py-4"
                style={{ borderTop: i > 0 ? `1px solid ${C.hairline}` : "none", background: i % 2 ? C.surfaceSoft : "#fff" }}>
                <span className="text-[13px] font-semibold" style={{ color: C.green900 }}>{label}</span>
                <span className="text-[11px]" style={{ fontFamily: MONO, letterSpacing: ".18em", color: C.sage }}>OPEN 시 공개</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 06 이용 안내 ── */}
        <section id="guide" className="dg-reveal mt-16 lg:mt-24">
          <SectionHead no="06" cap="NOTICE" title="이용 안내" lead="체크인/아웃 · 취소 규정 · 반려동물 등 — 확정 후 게시" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {["체크인 · 체크아웃", "취소 · 환불 규정", "이용 규칙"].map((t) => (
              <div key={t} className="px-5 py-6 text-left" style={{ border: `1px solid ${C.hairline}`, background: "#fff" }}>
                <div className="text-[13px] font-bold mb-3" style={{ color: C.green900 }}>{t}</div>
                {[100, 82, 64].map((w, i) => (
                  <div key={i} className="mb-2 rounded-sm" style={{ height: 10, width: `${w}%`, background: C.surfaceSoft }} />
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ── 07 오시는 길 ── */}
        <section id="location" className="dg-reveal mt-16 lg:mt-24">
          <SectionHead no="07" cap="LOCATION" title="오시는 길" lead="주소·주차 안내가 들어갈 자리예요" />
          <Ph h={260} label="MAP" />
        </section>

        {/* 오픈 알림 + 돌아가기 */}
        <div className="dg-reveal mt-16 lg:mt-20 flex flex-col sm:flex-row items-center justify-center gap-3">
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
