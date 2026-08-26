import Link from "next/link";
import { STAYS } from "@/lib/stays";

/**
 * 숙박공구 숙소 카드 목록 — 스크롤 따라 카드가 떠오르는 순수 CSS 리빌.
 * animation-timeline: view() (스크롤 연동 애니메이션)를 지원하는 브라우저에서만 효과가 붙고,
 * 미지원 브라우저(구형 사파리 등)에선 @supports 밖이라 그냥 정상 표시된다 — JS 없음.
 */
export default function StayDealsSection() {
  const stays = STAYS; // 마감 공구도 '공구 마감' 표시로 남긴다 (다녀간 공구의 흔적 = 신뢰)
  if (stays.length === 0) return null;

  return (
    <section id="hotel-deals" className="bp-band relative py-14 lg:py-20">
      <span className="bp-gutter bp-gutter-l">STAY DEALS — {String(stays.length).padStart(2, "0")} LISTED</span>
      <span className="bp-gutter bp-gutter-r">BLEND PICK 직접 계약</span>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <style>{`
        @keyframes stay-card-reveal {
          from {
            opacity: 0;
            transform: translateY(28%);
            filter: brightness(0.25) blur(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: brightness(1) blur(0);
          }
        }
        @supports (animation-timeline: view()) {
          .stay-reveal {
            animation: stay-card-reveal both ease-out;
            animation-timeline: view();
            /* 카드가 화면 아래서 들어와 55% 지점까지 오는 동안 완성 */
            animation-range: entry 0% entry 55%;
          }
        }
        .stay-card { transition: box-shadow .25s ease, transform .25s ease; }
        .stay-card:hover { transform: translateY(-4px); box-shadow: 0 14px 34px rgba(28,36,24,.14); }
        .stay-card:hover .stay-img { transform: scale(1.04); }
        .stay-img { transition: transform .5s ease; }
      `}</style>

      {/* 헤딩 행 — 우측 인덱스 + 하단 헤어라인 */}
      <div className="flex items-end justify-between gap-6 pb-5 mb-8 lg:mb-10" style={{ borderBottom: "1px solid #E4E1D6" }}>
        <div>
          <div className="ds-caption mb-2">STAY DEALS</div>
          <h2 className="ds-serif text-2xl lg:text-[28px] font-semibold m-0" style={{ color: "#1C2418" }}>
            지금 만날 수 있는 숙소
          </h2>
          <p className="text-[13px] mt-2" style={{ color: "#6B7263" }}>
            호텔부터 펜션까지 — 블랜드픽이 직접 계약한 숙소만 올라와요.
          </p>
        </div>
        <span className="hidden sm:block text-[11px]" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500, letterSpacing: ".2em", color: "#9AA391" }}>
          {String(stays.length).padStart(2, "0")} STAYS · {String(stays.filter((s) => s.status === "open").length).padStart(2, "0")} OPEN
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {stays.map((s) => {
          const open = s.status === "open";
          const closed = s.status === "closed";
          const card = (
            <article
              className="stay-reveal stay-card overflow-hidden bg-white h-full flex flex-col"
              style={{ border: "1px solid #E4E1D6", boxShadow: "0 6px 18px rgba(28,36,24,.07)" }}
            >
              <div className="relative overflow-hidden" style={{ aspectRatio: "16 / 9", background: "#EFEDE4" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image} alt={s.name} className="stay-img w-full h-full object-cover"
                  style={open ? undefined : { filter: "saturate(.55) brightness(.92)" }} />
                <span className="absolute top-3 left-3 text-[10px] font-bold px-2 py-1"
                  style={{
                    letterSpacing: "0.14em",
                    background: open ? "#244B1F" : closed ? "#4A5442" : "#E9C46A",
                    color: open || closed ? "#fff" : "#1C2418",
                  }}>
                  {open ? "NOW OPEN" : closed ? "공구 마감" : "COMING SOON"}
                </span>
                <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-1"
                  style={{ letterSpacing: "0.14em", background: "rgba(255,255,255,.92)", color: "#4A5442" }}>
                  {s.type}
                </span>
              </div>
              <div className="p-5 lg:p-6 flex flex-col flex-1">
                <p className="ds-mono text-[11px] m-0" style={{ letterSpacing: "0.08em", color: "#8B927F" }}>{s.region}</p>
                <h3 className="ds-serif text-lg lg:text-xl font-semibold mt-1 mb-2" style={{ color: "#1C2418" }}>{s.name}</h3>
                <p className="text-[13px] leading-relaxed m-0 flex-1" style={{ color: "#6B7263" }}>{s.desc}</p>
                <div className="mt-4">
                  {open ? (
                    <span className="inline-block text-[13px] font-bold px-5 py-2.5" style={{ background: "#244B1F", color: "#fff" }}>
                      예약하러 가기 →
                    </span>
                  ) : closed ? (
                    <span className="inline-block text-[13px] font-bold px-5 py-2.5" style={{ background: "#F5F3EA", color: "#9A9482" }}>
                      공구가 마감되었어요
                    </span>
                  ) : (
                    <span className="inline-block text-[13px] font-bold px-5 py-2.5" style={{ background: "#F5F3EA", color: "#9A9482" }}>
                      {s.href ? "미리 보기 →" : "오픈 준비 중"}
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
          // 마감 공구는 링크 없이 카드만 — soon은 티저 페이지가 있으면 연결
          return s.href && !closed ? (
            <Link key={s.key} href={s.href} className="block h-full">{card}</Link>
          ) : (
            <div key={s.key} className="h-full">{card}</div>
          );
        })}
      </div>
      </div>
    </section>
  );
}
