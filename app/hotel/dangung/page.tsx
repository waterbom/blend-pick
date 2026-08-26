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

      {/* ── 히어로 — 한옥 정원 사진 + 페이드인 타이틀 ── */}
      <section className="dg-hero relative overflow-hidden">
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
        {/* 미세 그레인 — 스크린샷 원본의 업스케일 뭉개짐을 필름 질감으로 가림 */}
        <div className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,.02) 0 1px, transparent 1px 3px)," +
              "repeating-linear-gradient(-45deg, rgba(0,0,0,.025) 0 1px, transparent 1px 3px)",
            mixBlendMode: "overlay",
          }} />

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

      <div className="max-w-[960px] mx-auto px-5 lg:px-8 py-12 lg:py-16 text-center">
        {/* COMING SOON 밴드 */}
        <div className="dg-reveal flex flex-col items-center justify-center gap-2.5 py-14 lg:py-16"
          style={{ border: `1px solid ${C.hairline}`, background: `repeating-linear-gradient(45deg,#FFFFFF,#FFFFFF 12px,${C.surfaceSoft} 12px,${C.surfaceSoft} 24px)` }}>
          <span className="text-[10px]" style={{ fontFamily: MONO, color: C.sage, letterSpacing: ".28em" }}>COMING SOON</span>
          <span className="text-[18px] lg:text-[22px] font-semibold" style={{ fontFamily: SERIF, color: C.green900 }}>
            공구 오픈 준비 중입니다
          </span>
          <span className="text-[12.5px] lg:text-[13px]" style={{ color: C.muted }}>
            확정된 구성과 요금을 먼저 만나보세요 — 오픈 일정은 곧 공개돼요
          </span>
        </div>

        {/* ── 01 단궁의 장점 — 메인 한 줄씩만, 사진은 준비되는 대로 각 칸에 걸림 ── */}
        <section id="about" className="dg-reveal mt-16 lg:mt-24">
          <SectionHead no="01" cap="WHY DANGUNG" title="단궁을 골라야 하는 이유" lead="핵심만 딱 — 사진은 준비되는 대로 하나씩 걸려요" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1px]" style={{ background: C.hairline, border: `1px solid ${C.hairline}` }}>
            {[
              ["PRIVATE", "완전한 독채 — 고성방가에도 자유"],
              ["ALL-WEATHER BBQ", "어닝 완비 — 비 오는 날에도 바베큐"],
              ["KIDS & GARDEN", "넓은 잔디 마당 — 아이들과 다양한 놀이"],
              ["NEXT-DOOR FOOD", "바로 옆 곰탕집 — 포장 & 투숙객 할인"],
              ["RENTAL", "대관 가능 — 세미뷔페 세팅"],
              ["SNAP", "전용 사진작가 스냅 — 웨딩 · 우정 · 부모님"],
              ["PARTY ROOM", "주류 세팅 · 스튜디오 조명 · 바 테이블 — 2층 휴식 · 루프탑 BBQ"],
              ["CLEAN & CARE", "단궁 직원 직접 청소 — 항상 청결"],
            ].map(([cap, main]) => (
              <div key={cap} className="bg-white px-5 py-6 lg:py-7 text-left">
                <div className="text-[9px] lg:text-[10px] mb-2" style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".26em", color: C.sage }}>{cap}</div>
                <div className="text-[14px] lg:text-[15.5px] font-bold leading-snug" style={{ color: C.green900 }}>{main}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 02 핫 플레이스 — 셀럽·방송 이슈. 영상·사진 확보되는 대로 교체 ── */}
        <section id="buzz" className="dg-reveal mt-16 lg:mt-24">
          <SectionHead no="02" cap="HOT PLACE" title="이미 다녀간 그 곳" lead="영상과 사진은 준비 중이에요 — 확보되는 대로 공개할게요" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {[
              { cap: "LIVE AT DANGUNG", t: "아이브 단독 콘서트", d: "단궁에서 열렸던 아이브 단독 콘서트 현장", ph: "VIDEO — 준비 중" },
              { cap: "NEARBY", t: "BTS가 다녀간 찜질방", d: "단궁 근처, BTS가 다녀간 그 찜질방", ph: "PHOTO — 준비 중" },
              { cap: "ON AIR", t: "나혼자산다 속 찜질방", d: "'나 혼자 산다'에 나온 찜질방도 가까이에", ph: "PHOTO — 준비 중" },
            ].map((c) => (
              <div key={c.t} className="text-left" style={{ border: `1px solid ${C.hairline}` }}>
                <Ph h={170} label={c.ph} />
                <div className="px-5 py-5 bg-white">
                  <div className="text-[9px] mb-1.5" style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".26em", color: C.sage }}>{c.cap}</div>
                  <div className="text-[14.5px] font-bold" style={{ color: C.green900 }}>{c.t}</div>
                  <p className="m-0 mt-1.5 text-[12.5px]" style={{ color: C.muted }}>{c.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 03 공구 특가 ── */}
        <section id="pricing" className="dg-reveal mt-16 lg:mt-24">
          <SectionHead no="03" cap="SPECIAL PRICE" title="공구 특가" lead="정가 1박 700,000원 — 블랜드픽 공구로만 만나는 특가예요" />

          {/* 독채 + 파티룸 묶음 특가 — 최상단 강조 */}
          <div className="mb-6 px-6 py-7 lg:py-8 text-center" style={{ background: C.green900 }}>
            <div className="text-[10px] mb-2.5" style={{ fontFamily: MONO, fontWeight: 600, letterSpacing: ".3em", color: "#AFC7A3" }}>
              SET — 단궁 통째로
            </div>
            <div className="text-[19px] lg:text-[24px] font-semibold" style={{ fontFamily: SERIF, color: "#fff" }}>
              독채 + 파티룸 한 번에
            </div>
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-0">
              <div className="px-7 py-1.5 sm:border-r" style={{ borderColor: "rgba(255,255,255,.22)" }}>
                <div className="text-[10.5px] mb-1" style={{ color: "rgba(255,255,255,.65)" }}>주중 (일–목)</div>
                <div className="text-[22px] lg:text-[26px] font-bold" style={{ color: "#fff" }}>800,000원</div>
              </div>
              <div className="px-7 py-1.5">
                <div className="text-[10.5px] mb-1" style={{ color: "rgba(255,255,255,.65)" }}>주말 · 공휴일</div>
                <div className="text-[22px] lg:text-[26px] font-bold" style={{ color: "#fff" }}>1,000,000원</div>
              </div>
            </div>
            <p className="m-0 mt-3.5 text-[12px]" style={{ color: "rgba(255,255,255,.72)" }}>
              두 공간을 함께 대관하면 세트 특가가 적용돼요
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 text-left">
            {[
              {
                head: "독채 펜션 · 1박",
                rows: [
                  ["평시 주중 (일–목)", "450,000원", true],
                  ["평시 주말 · 공휴일", "540,000원", true],
                  ["준성수기 주중", "450,000원", true],
                  ["준성수기 주말", "520,000원", true],
                  ["극성수기", "550,000원", true],
                  ["연말 · 명절", "오픈 시 공개", false],
                ],
              },
              {
                head: "파티룸 · 1박",
                rows: [
                  ["주중 (일–목)", "550,000원", true],
                  ["주말 · 공휴일", "650,000원", true],
                ],
              },
              {
                head: "인원 · 옵션",
                rows: [
                  ["기준 인원", "6인 · 최대 16인"],
                  ["인원 추가 (1인)", "20,000원 — 침구 1세트 포함"],
                  ["유아", "무료 — 정원 미포함"],
                  ["바베큐 세팅 (6인 기준)", "50,000원 — 그릴 · 집게 · 토치 포함"],
                  ["숯 추가 (1회)", "20,000원 — 석쇠 포함"],
                  ["그릴 추가", "30,000원"],
                ],
              },
            ].map((g) => (
              <div key={g.head}>
                <div className="px-5 py-3 text-[11px]"
                  style={{ fontFamily: MONO, fontWeight: 600, letterSpacing: ".22em", color: "#fff", background: C.green900 }}>
                  {g.head}
                </div>
                <div style={{ border: `1px solid ${C.hairline}`, borderTop: "none" }}>
                  {g.rows.map(([label, value, strike], i) => (
                    <div key={String(label)} className="flex items-center justify-between gap-4 px-5 py-3.5"
                      style={{ borderTop: i > 0 ? `1px solid ${C.hairline}` : "none", background: i % 2 ? C.surfaceSoft : "#fff" }}>
                      <span className="text-[13px] font-semibold shrink-0" style={{ color: C.green900 }}>{label}</span>
                      <span className="text-[12.5px] lg:text-[13px] text-right" style={{ color: value === "오픈 시 공개" ? C.sage : C.muted, fontFamily: value === "오픈 시 공개" ? MONO : undefined, letterSpacing: value === "오픈 시 공개" ? ".14em" : undefined }}>
                        {strike && (
                          <s className="mr-2 text-[11.5px]" style={{ color: "#B4AF9F" }}>700,000원</s>
                        )}
                        {strike ? <b style={{ color: C.green800 }}>{value}</b> : value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 04 이용 안내 ── */}
        <section id="guide" className="dg-reveal mt-16 lg:mt-24">
          <SectionHead no="04" cap="NOTICE" title="이용 안내" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {[
              {
                t: "체크인 · 체크아웃",
                items: ["체크인 15:00 · 체크아웃 11:00", "얼리 체크인은 어려워요", "레이트 체크아웃은 사전 문의"],
              },
              {
                t: "취소 · 환불 규정",
                items: ["체크인 7일 전까지 100% 환불", "이후 일자별 70% → 50% → 30% 차등", "상세 기준은 예약 페이지에 안내"],
              },
              {
                t: "이용 규칙",
                items: ["반려동물 동반 불가 — 잔디·한옥 보호", "위반 시 즉시 퇴실 · 환불 불가", "보증금 100,000원 — 퇴실 점검 후 환급"],
              },
            ].map((card) => (
              <div key={card.t} className="px-5 py-6 text-left" style={{ border: `1px solid ${C.hairline}`, background: "#fff" }}>
                <div className="text-[13px] font-bold mb-3" style={{ color: C.green900 }}>{card.t}</div>
                <ul className="m-0 p-0 list-none">
                  {card.items.map((it) => (
                    <li key={it} className="mb-2 pl-3.5 relative text-[12.5px] leading-relaxed" style={{ color: C.muted }}>
                      <span aria-hidden className="absolute left-0 top-[8px] w-[5px] h-[5px]" style={{ background: C.sage }} />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* 투숙객 제휴 혜택 밴드 */}
          <div className="mt-6 px-6 py-6 text-center" style={{ background: C.surfaceSoft, border: `1px solid ${C.hairline}` }}>
            <div className="text-[10px] mb-2" style={{ fontFamily: MONO, fontWeight: 600, letterSpacing: ".28em", color: C.sage }}>
              STAY BENEFIT
            </div>
            <div className="text-[14px] lg:text-[15px] font-semibold" style={{ fontFamily: SERIF, color: C.green900 }}>
              투숙객이라면 — 단궁 곰탕 20% 할인
            </div>
            <p className="m-0 mt-1.5 text-[12.5px]" style={{ color: C.muted }}>
              곰탕 이용 후 카페까지 50% 할인 · 결제 시 영수증으로 인증하면 돼요
            </p>
          </div>
        </section>

        {/* ── 07 오시는 길 ── */}
        <section id="location" className="dg-reveal mt-16 lg:mt-24">
          <SectionHead no="05" cap="LOCATION" title="오시는 길" lead="주소·주차 안내가 들어갈 자리예요" />
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
