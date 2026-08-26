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
} as const;

export const metadata = {
  title: "단궁 펜션 공동구매 — 오픈 준비 중 · BLEND PICK",
  description: "독채 & 파티룸 펜션 공구 — 넓은 정원, 바베큐, 최대 24인. 오픈 소식을 가장 먼저 받아보세요.",
  openGraph: {
    title: "단궁 펜션 공동구매 — 오픈 준비 중 · BLEND PICK",
    description: "독채 & 파티룸 펜션 공구 — 넓은 정원, 바베큐, 최대 24인.",
    url: "https://shop.blendpunch.com/hotel/dangung",
    siteName: "BLEND PICK",
    type: "website",
    locale: "ko_KR",
  },
};

// 단궁 펜션 공구 티저 — 판매 오픈 전까지 커밍순으로 안내.
// 상세(달력·요금·예약)는 공구 일정 확정 후 이 페이지를 교체한다.
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

      <div className="max-w-[840px] mx-auto px-5 lg:px-8 py-14 lg:py-24 text-center">
        <div className="text-[10px] lg:text-[11px] mb-4" style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".3em", color: C.sage }}>
          PENSION · 공동구매 — 오직 블랜드픽에서만
        </div>
        <h1 className="m-0 text-[30px] lg:text-[48px] leading-[1.25]" style={{ fontFamily: SERIF, fontWeight: 700, color: C.green900 }}>
          단궁 펜션
        </h1>
        <p className="mt-4 text-[14px] lg:text-[15px] leading-relaxed" style={{ color: C.muted }}>
          넓은 정원을 통째로 쓰는 <b style={{ color: C.green900 }}>독채</b>와 <b style={{ color: C.green900 }}>파티룸</b> —
          다음 숙박공구를 준비하고 있어요.
        </p>

        {/* COMING SOON 밴드 */}
        <div className="mt-10 lg:mt-12 flex flex-col items-center justify-center gap-2.5 py-14 lg:py-16"
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
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-[1px]" style={{ background: C.hairline, border: `1px solid ${C.hairline}` }}>
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
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
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
