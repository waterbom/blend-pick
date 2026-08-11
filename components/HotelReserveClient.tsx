"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PACKAGES, ROOM_META, TIERS, getTier, nightlyWon, stayPriceWon, listWon, manLabel, nextISO,
  BOOKABLE_FROM, BOOKABLE_TO, minBookableCheckIn, saleScheduleFor, WON,
  type PkgKey, type RoomType, type Tier,
} from "@/lib/hotel";
import NeonCountdown from "@/components/NeonCountdown";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS = [7, 8, 9, 10]; // 2026 시즌
const YEAR = 2026;
const KAKAO_CHANNEL_URL = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL || "http://pf.kakao.com/_VyING/chat";
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

// 딥 포레스트 팔레트 (디자인 핸드오프 확정 토큰)
const C = {
  green900: "#1C2418",
  green800: "#244B1F",
  green700: "#2D5A27",
  sage: "#7A8B6F",
  sageLight: "#9FBF93",
  mintOnDark: "#C7D6C0",
  surfaceSoft: "#F6F4EE",
  hairline: "#E4E1D6",
  muted: "#6B7263",
  muted2: "#4A5442",
  muted3: "#8B927F",
  sunday: "#A65B4B",
  gold: "#E9C46A",       // 카운트다운 — 다크 그린 보색 계열 골드
  terracotta: "#A65B4B", // 주의 문구 강조
  disabledBg: "#FBFAF6",
  disabledText: "#CFCABB",
  ctaOff: "#DDD9CC",
} as const;

// 시즌별 톤 온 톤 달력 틴트 (셀 배경 / 범례 보더)
const TINT: Record<Tier, { bg: string; edge: string }> = {
  weekday:  { bg: "#FFFFFF", edge: "#C9D6BC" },
  shoulder: { bg: "#F1F5EC", edge: "#A8BC94" },
  saturday: { bg: "#E4EDDC", edge: "#87A26E" },
  peak:     { bg: "#D2E0C6", edge: "#5E7D46" },
  highpeak: { bg: "#BCCFAA", edge: "#2D5A27" },
};
const LEGEND_ORDER: Tier[] = ["weekday", "shoulder", "saturday", "peak", "highpeak"];

const SERIF = "'Noto Serif KR', serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

function fmtDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  const dow = WEEKDAYS[new Date(iso).getDay()];
  return `${m}월 ${d}일 (${dow})`;
}

// "2026. 7. 14" 표기 (히어로 인포 스트립)
function fmtDot(iso: string, withYear = true) {
  const [y, m, d] = iso.split("-").map(Number);
  return withYear ? `${y}. ${m}. ${d}` : `${m}. ${d}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

function calcRemain(targetISO: string, now: number) {
  const diff = new Date(targetISO).getTime() - now;
  if (diff <= 0) return null;
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}

// 섹션 라벨 (레터스페이싱 캡션)
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] lg:text-[11px] mb-2.5 lg:mb-4" style={{ letterSpacing: ".22em", color: C.sage }}>
      {children}
    </div>
  );
}

export default function HotelReserveClient({
  influencerId,
  influencerName,
  saleStart,
  saleDeadline,
  activeOptions = [],
  upcomingOptions = [],
}: {
  influencerId?: string | null;
  influencerName?: string | null;
  saleStart?: string; // 서버에서 계산된 인플루언서별 판매 시작 (없으면 클라이언트 폴백)
  saleDeadline?: string;
  activeOptions?: { id: string; name: string }[]; // 직접 유입 시 이동 가능한 진행 중 공구
  upcomingOptions?: { id: string; name: string; start: string }[]; // 진행 중이 없을 때 오픈 예정 공구 (커밍순)
}) {
  const router = useRouter();
  // 직접 유입 → select로 고른 진행 중 공구의 전용 링크로 이동
  const gotoInfluencer = (id: string) => { if (id) router.push(`/hotel/reserve?inf=${id}`); };
  // "2026-07-22T10:00:00+09:00" → "7/22(수) 10:00"
  const fmtOpenAt = (iso: string) => {
    const [y, mo, dd] = iso.slice(0, 10).split("-").map(Number);
    const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(y, mo - 1, dd)).getUTCDay()];
    return `${mo}/${dd}(${dow}) ${iso.slice(11, 16)}`;
  };
  const [pkg, setPkg] = useState<PkgKey>("p2");
  const [room, setRoom] = useState<RoomType>("디럭스 더블");
  const [monthIdx, setMonthIdx] = useState(0); // MONTHS 인덱스
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [soldOut, setSoldOut] = useState<Set<string>>(new Set());
  // 예약 컷오프(체크인 5일 전까지) — SSR/CSR 시간 차 hydration 문제 없게 마운트 후 계산
  const [minCI, setMinCI] = useState<string>(BOOKABLE_FROM);
  useEffect(() => {
    const v = minBookableCheckIn();
    setMinCI(v > BOOKABLE_FROM ? v : BOOKABLE_FROM);
  }, []);
  const [benefitsOpen, setBenefitsOpen] = useState(false); // 투숙객 혜택 이미지 모달

  // 선택 객실의 실시간 재고 마감일 (DB)
  useEffect(() => {
    fetch(`/api/hotel/availability?room=${encodeURIComponent(room)}`)
      .then((r) => r.json())
      .then((d) => setSoldOut(new Set<string>(d.soldOut || [])))
      .catch(() => setSoldOut(new Set<string>()));
  }, [room, checkIn, checkOut]);

  const pack = PACKAGES[pkg];
  const rm = ROOM_META[room];
  const month = MONTHS[monthIdx];

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // 인플루언서 링크(?inf=)별 판매 일정 — 서버가 내려준 값 우선(DB 일정 포함), 없으면 클라이언트 폴백
  const schedule = saleStart && saleDeadline
    ? { start: saleStart, deadline: saleDeadline }
    : saleScheduleFor({ id: influencerId ?? undefined, name: influencerName ?? undefined });
  const saleFromISO = schedule.start.slice(0, 10);
  const saleToISO = schedule.deadline.slice(0, 10);
  const sale: "before" | "open" | "closed" =
    now < new Date(schedule.start).getTime() ? "before"
    : now > new Date(schedule.deadline).getTime() ? "closed" : "open";
  const remain = calcRemain(sale === "before" ? schedule.start : schedule.deadline, now);

  function resetDates() { setCheckIn(null); setCheckOut(null); }

  function choosePkg(k: PkgKey) {
    setPkg(k);
    setRoom(PACKAGES[k].rooms[0]); // 패키지 바꾸면 항상 해당 패키지 기본 객실로
    resetDates();
  }

  // 클릭 가능 여부.
  // - 재고 있는 날: 언제나 클릭 가능(입실/퇴실/재선택)
  // - 마감(sold-out)인 날: 입실이 정해진 상태에서 '퇴실'로만 선택 가능
  //   (퇴실일은 그 날 밤을 점유하지 않으므로 마감이어도 무방)
  function selectable(iso: string): boolean {
    if (iso < BOOKABLE_FROM || iso > BOOKABLE_TO) return false;
    // 예약 컷오프: 체크인 5일 전까지만 (퇴실일은 입실 이후라 자동으로 통과)
    if (iso < minCI) return false;
    if (!soldOut.has(iso)) return true;
    if (checkIn && !checkOut && iso > checkIn) {
      return daysBetween(checkIn, iso) <= maxNights(checkIn);
    }
    return false;
  }

  // 입실일부터 연속 예약 가능한 최대 박수 (재고 마감 전까지)
  function maxNights(from: string): number {
    let n = 0;
    let cur = from;
    while (cur <= BOOKABLE_TO && !soldOut.has(cur)) { n++; cur = nextISO(cur); }
    return Math.max(1, n);
  }

  // 날짜 클릭 → 입실/퇴실 범위 선택
  function onDateClick(iso: string) {
    // 새로 시작: 입실이 없거나 이미 범위가 완성된 경우
    if (!checkIn || checkOut) { setCheckIn(iso); setCheckOut(null); return; }
    // 입실보다 이르거나 같으면 입실을 다시 잡음
    if (iso <= checkIn) { setCheckIn(iso); setCheckOut(null); return; }
    // 퇴실 후보: 입실~퇴실 사이 밤이 전부 재고 있어야(연속 예약 가능 박수 이내)
    const n = daysBetween(checkIn, iso);
    if (n <= maxNights(checkIn)) setCheckOut(iso);
    else { setCheckIn(iso); setCheckOut(null); }
  }

  const cells = useMemo(() => {
    const first = new Date(YEAR, month - 1, 1).getDay();
    const days = new Date(YEAR, month, 0).getDate();
    const arr: (string | null)[] = [];
    for (let i = 0; i < first; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(isoOf(YEAR, month, d));
    return arr;
  }, [month]);

  const nights = checkIn && checkOut ? daysBetween(checkIn, checkOut) : 0;
  const complete = !!(checkIn && checkOut && nights > 0);
  const total = complete ? stayPriceWon(pkg, checkIn!, nights) : 0;
  const listTotal = complete ? listWon(pkg, room, nights) : 0;
  const discountPct = listTotal > total && listTotal > 0 ? Math.round((1 - total / listTotal) * 100) : 0;

  // 인플루언서 전용 링크로만 구매 가능 — 직접 유입(링크 없음)은 결제 진입 차단
  const linkOnly = !influencerId;
  const ctaOn = complete && sale === "open" && !linkOnly;

  // 예약 진행 CTA — 데스크톱 지갑 아래 / 모바일 하단 고정 바가 같은 버튼을 공유 (상태 분기 한 벌 유지)
  const summaryCta =
    linkOnly && activeOptions.length === 0 && upcomingOptions.length > 0 ? (
      // 진행 중은 없고 오픈 예정만 있으면 — 커밍순 버튼 (전용 링크의 오픈 카운트다운으로 이동)
      <button type="button"
        onClick={() => gotoInfluencer(upcomingOptions[0].id)}
        className="w-full py-[15px] text-[14px] font-bold text-center cursor-pointer transition-all duration-150 hover:brightness-105"
        style={{ background: C.gold, color: C.green900, letterSpacing: ".04em", border: "none" }}
      >
        ◷ COMING SOON — {upcomingOptions[0].name} 공구 {fmtOpenAt(upcomingOptions[0].start)} 오픈
      </button>
    ) : linkOnly && activeOptions.length > 0 ? (
      // 직접 유입인데 진행 중 공구가 있으면 — 비활성 버튼 대신 공구 선택 select
      <select
        defaultValue=""
        onChange={(e) => gotoInfluencer(e.target.value)}
        className="w-full py-[15px] text-[14px] font-bold text-center cursor-pointer"
        style={{ background: C.green800, color: "#fff", letterSpacing: ".04em", border: "none" }}
      >
        <option value="" disabled>진행 중인 공구 선택 → 예약하러 가기</option>
        {activeOptions.map((o) => (
          <option key={o.id} value={o.id}>{o.name} 공구로 이동</option>
        ))}
      </select>
    ) : (
      <button
        disabled={!ctaOn}
        onClick={() => {
          if (!ctaOn) return;
          const infParam = influencerId ? `&inf=${influencerId}` : "";
          router.push(`/hotel/reserve/checkout?pkg=${pkg}&room=${encodeURIComponent(room)}&in=${checkIn}&out=${checkOut}${infParam}`);
        }}
        className="w-full py-[15px] text-[14px] font-bold text-center transition-colors duration-150"
        style={{
          background: ctaOn ? C.green800 : C.ctaOff,
          color: ctaOn ? "#fff" : C.muted3,
          letterSpacing: ".04em",
          cursor: ctaOn ? "pointer" : "default",
        }}
        suppressHydrationWarning
      >
        {linkOnly
          ? "인플루언서 전용 링크로만 예약 가능"
          : sale === "before"
          ? remain
            ? `오픈까지 ${remain.d > 0 ? `${remain.d}일 ` : ""}${pad(remain.h)}:${pad(remain.m)}:${pad(remain.s)}`
            : "잠시 후 오픈"
          : sale === "closed" ? "판매가 마감되었어요"
          : complete ? `예약 진행 · ${WON(total)}` : "예약 진행"}
      </button>
    );

  return (
    <div style={{ background: "#FFFFFF", color: C.green900 }}>
      {/* ── 히어로 (화이트 — 페이지와 이어지게 배경·경계 없음) ── */}
      <section style={{ background: "#FFFFFF", color: C.green900 }}>
        <div className="max-w-[1240px] mx-auto px-5 lg:px-12 pt-8 lg:pt-14">
          {/* 네온 카운트다운 — 오픈 전엔 오픈까지, 진행 중엔 마감까지 */}
          {!linkOnly && (
            <div className="text-center pb-8 lg:pb-14" suppressHydrationWarning>
              <div className="text-[10px] lg:text-[11px] mb-4 lg:mb-6"
                style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".3em", color: C.sage }}>
                {sale === "before" ? "OPEN — 오픈까지" : sale === "open" ? "CLOSING — 마감까지" : "CLOSED — 판매 마감"}
              </div>
              <div className="text-[34px] lg:text-[64px]" style={{ color: sale === "closed" ? "rgba(122,139,111,.35)" : C.sageLight }}>
                <NeonCountdown remain={remain} />
              </div>
            </div>
          )}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end">
            <div>
              <div className="text-[10px] lg:text-[11px] mb-3 lg:mb-[18px]"
                style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".28em", color: C.sage }}>
                HOTEL 공동구매 — 오직 블렌드픽에서만
              </div>
              <h1 className="m-0 text-[27px] lg:text-[48px] leading-[1.3] lg:leading-[1.2]"
                style={{ fontFamily: SERIF, fontWeight: 600, color: C.green900 }}>
                여수 UTOP 마리나 호텔
              </h1>
              <p className="mt-3 lg:mt-[18px] mb-0 text-[13px] lg:text-[15px] leading-relaxed" style={{ color: C.muted }}>
                오션뷰 객실 · 조식 · 인피니티풀 · 레이트 체크아웃까지, 한 번에.
              </p>
            </div>
            {/* 예약 조회 — 카운트다운 숫자는 상단 네온 시계로 이동, 여기엔 버튼만 */}
            <div className="hidden lg:block lg:pb-1 lg:text-right">
              <a href="/hotel/lookup"
                className="inline-block px-5 py-2.5 text-[11px] font-bold transition-colors duration-150"
                style={{ background: C.gold, color: C.green900, letterSpacing: ".12em" }}>
                예약 조회 →
              </a>
            </div>
          </div>

          {/* 예약 조회 (모바일) */}
          <a href="/hotel/lookup"
            className="lg:hidden mt-4 flex items-center justify-center py-3 text-[12px] font-bold"
            style={{ background: C.gold, color: C.green900, letterSpacing: ".12em" }}>
            예약 조회 →
          </a>

          {/* 인포 스트립 */}
          <div className="mt-6 lg:mt-10 pt-4 lg:pt-9 pb-6 lg:pb-8 grid grid-cols-2 gap-3 lg:flex lg:gap-12 text-[12px] lg:text-[13px]"
            style={{ borderTop: `1px solid ${C.hairline}`, color: C.muted2 }}>
            <div>
              <span className="block mb-1 text-[10px] lg:text-[11px]" style={{ letterSpacing: ".1em", color: C.sage }}>판매기간</span>
              <span className="hidden lg:inline">{fmtDot(saleFromISO)} — {fmtDot(saleToISO, false)}</span>
              <span className="lg:hidden">{fmtDot(saleFromISO, false)} — {fmtDot(saleToISO, false)}</span>
            </div>
            <div>
              <span className="block mb-1 text-[10px] lg:text-[11px]" style={{ letterSpacing: ".1em", color: C.sage }}>투숙기간</span>
              <span className="hidden lg:inline">{fmtDot(BOOKABLE_FROM)} — {fmtDot(BOOKABLE_TO, false)}</span>
              <span className="lg:hidden">{fmtDot(BOOKABLE_FROM, false)} — {fmtDot(BOOKABLE_TO, false)}</span>
            </div>
            <div className="hidden lg:block">
              <span className="block mb-1 text-[11px]" style={{ letterSpacing: ".1em", color: C.sage }}>연휴기간</span>
              하단 시즌 구분 참조
            </div>
          </div>
        </div>
      </section>

      {/* 직접 유입 안내 — 전용 링크로만 구매 가능 (진행 중 공구가 있으면 select로 이동 지원) */}
      {linkOnly && (
        <div className="max-w-[1240px] mx-auto px-5 lg:px-12 pt-5">
          <div className="px-4 py-3.5 text-[13px] leading-relaxed" style={{ background: C.surfaceSoft, border: `1px solid ${C.hairline}`, color: C.muted2 }}>
            🔒 이 공동구매는 <b style={{ color: C.green800 }}>인플루언서 전용 링크를 통해서만</b> 예약할 수 있어요.
            {activeOptions.length > 0
              ? " 아래에서 진행 중인 공구를 선택하면 해당 예약 페이지로 이동해요."
              : upcomingOptions.length > 0
              ? ` 다음 공구가 곧 열려요 — ${upcomingOptions[0].name} 공구 ${fmtOpenAt(upcomingOptions[0].start)} 오픈 예정.`
              : " 공유받은 링크로 다시 접속해주세요."}{" "}
            이미 예약하신 분은 상단 <b>예약 조회</b>를 이용하시면 돼요.
            {activeOptions.length === 0 && upcomingOptions.length > 0 && (
              <span className="block mt-3">
                {upcomingOptions.map((u) => (
                  <button key={u.id} type="button" onClick={() => gotoInfluencer(u.id)}
                    className="inline-block mr-2 px-3.5 py-2.5 text-[13px] font-bold cursor-pointer"
                    style={{ background: C.gold, color: C.green900, borderRadius: 8, border: "none" }}>
                    ◷ COMING SOON — {u.name} 공구 {fmtOpenAt(u.start)} 오픈 →
                  </button>
                ))}
              </span>
            )}
            {activeOptions.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => gotoInfluencer(e.target.value)}
                className="mt-3 block w-full lg:w-auto px-3.5 py-2.5 text-[13px] font-bold cursor-pointer"
                style={{ border: `1.5px solid ${C.green800}`, color: C.green800, background: "#fff", borderRadius: 8 }}
              >
                <option value="" disabled>▾ 진행 중인 공구 선택 — 예약하러 가기</option>
                {activeOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} 공구로 이동</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* ── 본문 2단 그리드 ── */}
      <div className="max-w-[1240px] mx-auto px-5 lg:px-12 py-6 lg:py-12 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 lg:gap-12">
        {/* 좌측 레일 */}
        <div>
          <SectionLabel>패키지 선택</SectionLabel>
          <div className="flex lg:flex-col">
            {(Object.keys(PACKAGES) as PkgKey[]).map((k) => {
              const on = pkg === k;
              return (
                <button
                  key={k}
                  onClick={() => choosePkg(k)}
                  className="flex-1 lg:flex-none flex flex-col lg:flex-row items-center lg:items-baseline justify-center lg:justify-between gap-0.5 lg:gap-2 py-3 lg:py-4 lg:px-[18px] -ml-px first:ml-0 lg:ml-0 transition-colors duration-150 text-left"
                  style={{
                    background: on ? C.green800 : "#fff",
                    color: on ? "#fff" : C.green900,
                    border: `1px solid ${on ? C.green800 : C.hairline}`,
                    borderWidth: undefined,
                  }}
                >
                  <span className="font-bold text-[14px] lg:text-[15px] lg:font-semibold">
                    <span className="lg:hidden">{PACKAGES[k].label.replace(" 패키지", "인").replace("인인", "인")}</span>
                    <span className="hidden lg:inline">{PACKAGES[k].label}</span>
                  </span>
                  <span className="text-[10px] lg:text-[11.5px]" style={{ color: on ? C.sageLight : C.muted3 }}>
                    <span className="lg:hidden">{k === "p2" ? "기본" : "추가 무료"}</span>
                    <span className="hidden lg:inline">{k === "p2" ? PACKAGES[k].rooms.join(" / ") : "추가 인원 무료"}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* 포함 사항 */}
          <div className="mt-4 lg:mt-7 p-4 lg:p-5" style={{ background: C.surfaceSoft }}>
            <div className="hidden lg:block text-[11px] mb-3" style={{ letterSpacing: ".2em", color: C.sage }}>포함 사항</div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 lg:flex-col lg:gap-2 text-[12.5px] lg:text-[13.5px]">
              {pack.includes.map((x, i) => (
                <span key={x} className="lg:block">
                  {i > 0 && <span className="lg:hidden mr-3.5" style={{ color: TINT.saturday.edge }}>·</span>}
                  {x}
                </span>
              ))}
            </div>
            <div className="mt-3 pt-3 text-[11.5px] lg:text-[12px] leading-[1.7]"
              style={{ borderTop: "1px solid #E0DCD0", color: C.terracotta }}>
              인원 추가비는 <b>3·4인 패키지 무료</b>, 2인 패키지 <b>1인당 10,000원</b>입니다. 침구 추가는 어렵습니다.
              <span style={{ color: C.muted }}> 연박 시 조식·인피니티풀은 매일 제공됩니다.</span>
            </div>
          </div>

          {/* 투숙객 전용 제휴 혜택 — 버튼 클릭 시 안내 이미지 모달 */}
          <button onClick={() => setBenefitsOpen(true)}
            className="mt-[1px] w-full flex items-center justify-between px-4 lg:px-5 py-3.5 text-left transition-colors duration-150 hover:brightness-[1.03]"
            style={{ background: C.green800 }}>
            <span className="text-[13px] font-semibold text-white">
              🎁 투숙객 전용 혜택 · 그 외 즐길거리
              <span className="hidden lg:inline ml-2 font-normal text-[11.5px]" style={{ color: C.mintOnDark }}>요트투어 · 아쿠아플라넷 · 포차 할인</span>
            </span>
            <span className="text-[12px] shrink-0" style={{ fontFamily: MONO, color: C.gold }}>보기 →</span>
          </button>

          {/* 혜택 안내 이미지 모달 */}
          {benefitsOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 lg:p-8"
              style={{ background: "rgba(28,36,24,0.72)" }}
              onClick={() => setBenefitsOpen(false)}>
              <div className="w-full max-w-2xl max-h-full flex flex-col" style={{ background: "#fff" }}
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 lg:px-5 py-3 shrink-0"
                  style={{ background: C.green800 }}>
                  <p className="text-[13px] font-semibold text-white" style={{ fontFamily: SERIF }}>
                    투숙객 전용 혜택 · 그 외 즐길거리
                  </p>
                  <button onClick={() => setBenefitsOpen(false)}
                    className="text-white text-lg leading-none px-1" aria-label="닫기">✕</button>
                </div>
                <div className="overflow-y-auto">
                  <img src="/hotel-benefits.jpeg" alt="투숙객 전용 제휴 혜택 안내 — 낭만포차·딸기모찌 할인, 야간 요트 투어, 아쿠아플라넷 20% 할인, 블루 요트 1인 무료"
                    className="w-full h-auto" draggable={false} />
                  <p className="px-4 py-3 text-[11px]" style={{ color: C.muted3, borderTop: `1px solid ${C.hairline}` }}>
                    이용 시 유탑 마리나 호텔 예약 내역(예약확정 문자)을 각 데스크에 보여주시면 돼요.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 객실 토글 + 사진 */}
          <div className="mt-6 lg:mt-4">
            <SectionLabel>객실 타입</SectionLabel>
            <div className="flex">
              {pack.rooms.map((r) => {
                const on = room === r;
                return (
                  <button key={r} onClick={() => { setRoom(r); resetDates(); }}
                    className="flex-1 text-center py-3 lg:py-2.5 text-[13px] lg:text-[12.5px] -ml-px first:ml-0 transition-colors duration-150"
                    style={{
                      background: on ? C.green800 : "#fff",
                      color: on ? "#fff" : C.muted,
                      fontWeight: on ? 600 : 400,
                      border: `1px solid ${on ? C.green800 : C.hairline}`,
                    }}>
                    {r}
                  </button>
                );
              })}
            </div>
            <div className={`mt-[1px] grid gap-[1px] ${rm.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {rm.images.map((src, i) => (
                <div key={src} className="relative overflow-hidden h-[160px] lg:h-[200px]"
                  style={{ background: `repeating-linear-gradient(45deg,${C.surfaceSoft},${C.surfaceSoft} 10px,#EDEAE0 10px,#EDEAE0 20px)`, border: `1px solid ${C.hairline}` }}>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px]"
                    style={{ fontFamily: MONO, color: C.sage }}>
                    객실 사진 {i + 1} — {room}
                  </span>
                  <img src={src} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                </div>
              ))}
            </div>
            <p className="mt-2.5 mb-0 text-[11.5px] lg:text-[12.5px] leading-relaxed" style={{ color: C.muted }}>
              {room} · {rm.bed} · {rm.capacity}
            </p>
          </div>
        </div>

        {/* 우측 달력 */}
        <div>
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setMonthIdx((i) => Math.max(0, i - 1))} disabled={monthIdx === 0}
                className="w-8 h-8 flex items-center justify-center text-base disabled:opacity-30 transition-colors duration-150"
                style={{ border: `1px solid ${C.hairline}`, color: C.muted2 }}>‹</button>
              <div className="text-[18px] lg:text-[22px]" style={{ fontFamily: SERIF, fontWeight: 600 }}>
                {YEAR}년 {month}월
              </div>
              <button onClick={() => setMonthIdx((i) => Math.min(MONTHS.length - 1, i + 1))} disabled={monthIdx === MONTHS.length - 1}
                className="w-8 h-8 flex items-center justify-center text-base disabled:opacity-30 transition-colors duration-150"
                style={{ border: `1px solid ${C.hairline}`, color: C.muted2 }}>›</button>
            </div>
            {/* 시즌 범례 (데스크톱) */}
            <div className="hidden lg:flex gap-3.5 flex-wrap justify-end">
              {LEGEND_ORDER.map((t) => (
                <div key={t} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: C.muted }}>
                  <span className="inline-block w-[11px] h-[11px]" style={{ background: TINT[t].bg, border: `1px solid ${TINT[t].edge}` }} />
                  {TIERS[t].label}
                </div>
              ))}
            </div>
          </div>

          {/* 시즌 범례 (모바일) */}
          <div className="flex lg:hidden gap-x-2.5 gap-y-1.5 flex-wrap mb-3">
            {LEGEND_ORDER.map((t) => (
              <div key={t} className="flex items-center gap-[5px] text-[10.5px]" style={{ color: C.muted }}>
                <span className="inline-block w-[11px] h-[11px]" style={{ background: TINT[t].bg, border: `1px solid ${TINT[t].edge}` }} />
                {TIERS[t].label}
              </div>
            ))}
          </div>

          {!complete && (
            <p className="text-[11px] lg:text-[12px] mb-2 font-medium" style={{ color: C.green700 }}>
              {checkIn ? "퇴실 날짜를 선택하세요" : "달력에서 입실 날짜를 선택하세요"}
            </p>
          )}

          {/* 요일 행 */}
          <div className="grid grid-cols-7 mb-1 lg:mb-1.5">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className="text-center text-[10px] lg:text-[11px] py-1"
                style={{ letterSpacing: ".15em", color: i === 0 ? C.sunday : i === 6 ? C.green800 : C.muted3 }}>
                {w}
              </div>
            ))}
          </div>

          {/* 달력 셀 */}
          <div className="grid grid-cols-7 gap-[2px] lg:gap-[3px]">
            {cells.map((iso, i) => {
              if (!iso) return <div key={`e${i}`} className="h-[56px] lg:h-[74px]" />;
              const [, , d] = iso.split("-").map(Number);
              const inRange = iso >= BOOKABLE_FROM && iso <= BOOKABLE_TO;
              const canPick = selectable(iso);
              const sold = inRange && soldOut.has(iso);
              const tier = getTier(iso);
              const isIn = iso === checkIn;
              const isOut = iso === checkOut;
              const isMid = !!(checkIn && checkOut && iso > checkIn && iso < checkOut);
              const endpoint = isIn || isOut;

              const bg = endpoint ? C.green800 : isMid ? "#EAF0E6" : !inRange ? C.disabledBg : TINT[tier].bg;
              const border = endpoint ? C.green800 : isMid ? "#C9D6BC" : !inRange ? "#F0EDE4" : C.hairline;

              return (
                <button
                  key={iso}
                  disabled={!canPick}
                  onClick={() => onDateClick(iso)}
                  className="h-[56px] lg:h-[74px] flex flex-col items-center justify-center gap-0.5 transition-colors duration-150"
                  style={{ background: bg, border: `1px solid ${border}`, cursor: canPick ? "pointer" : "default" }}
                >
                  <span className="text-[13px] lg:text-[15px] font-bold leading-none"
                    style={{ color: endpoint ? "#fff" : !inRange ? C.disabledText : sold && !canPick ? C.disabledText : C.green900 }}>
                    {d}
                  </span>
                  {inRange && (
                    endpoint ? (
                      <span className="text-[9.5px] lg:text-[11px] font-semibold" style={{ color: C.mintOnDark }}>
                        {isIn ? "입실" : "퇴실"}
                      </span>
                    ) : sold ? (
                      <span className="text-[9.5px] lg:text-[11px] font-bold" style={{ color: C.sunday }}>마감</span>
                    ) : iso < minCI ? (
                      <span className="text-[9.5px] lg:text-[11px] font-semibold" style={{ color: C.disabledText }}>예약마감</span>
                    ) : canPick ? (
                      <span className="text-[9.5px] lg:text-[11px] tnum" style={{ color: C.muted2 }}>
                        {manLabel(nightlyWon(pkg, iso))}
                      </span>
                    ) : null
                  )}
                </button>
              );
            })}
          </div>

          {/* 정책 라인 */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-6 mt-3.5 lg:mt-[18px] text-[11.5px] lg:text-[12.5px]" style={{ color: C.muted2 }}>
            <div><span className="font-bold" style={{ color: C.green800 }}>36개월 미만</span> 무료 투숙</div>
            <div><span className="font-bold" style={{ color: C.green800 }}>체크인 6일 전</span>까지 100% 환불</div>
            <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 font-bold transition-transform active:scale-[0.98]"
              style={{ background: "#FAE100", color: "#3C1E1E" }}>
              💬 취소·환불 문의 — 카카오톡 채널 →
            </a>
          </div>

          {/* ── 지갑 요약 (달력 아래 우측 정렬, 데스크톱 전용) — 카드 3장(일정·구성·할인)이 꽂힌 지갑,
               가운데 총 금액. 달력 오른쪽 라인에 맞춰 떨어지게 ml-auto. 모바일은 하단 고정 바 사용 ── */}
          <div className="hidden lg:block max-w-[560px] ml-auto mt-12">
        <div className="relative" style={{ height: "318px" }}>
          {/* 꽂혀 있는 카드들 — 위로 살짝씩 보이는 부분에 정보 표시 */}
          {[
            {
              label: "일정",
              value: complete
                ? `${fmtDate(checkIn!)} — ${fmtDate(checkOut!)}`
                : checkIn ? "퇴실 날짜를 선택하세요" : "달력에서 입실 날짜를 선택하세요",
              bg: C.green800, inset: "6%",
            },
            {
              label: "구성",
              value: complete ? `${nights}박 · ${pack.label} · ${room}` : `${pack.label} · ${room}`,
              bg: "#3D6136", inset: "3%",
            },
            {
              label: "할인",
              value: complete && discountPct > 0
                ? `정가 ${WON(listTotal)} → ${discountPct}% 할인`
                : "날짜 선택 시 계산돼요",
              bg: "#57744E", inset: "0%",
            },
          ].map((card, i) => (
            <div key={card.label} className="absolute"
              style={{
                top: `${i * 46}px`, left: card.inset, right: card.inset, height: "220px",
                background: card.bg, borderRadius: "16px", zIndex: i + 1,
                boxShadow: "0 -4px 14px rgba(28,36,24,.18)",
              }}>
              <div className="flex items-center justify-between gap-3 px-5" style={{ height: "46px" }}>
                <span className="text-[10px] font-bold shrink-0"
                  style={{ fontFamily: MONO, letterSpacing: ".22em", color: "rgba(255,255,255,.66)" }}>
                  {card.label}
                </span>
                <span className="text-[12.5px] lg:text-[13.5px] font-bold truncate tnum text-white" suppressHydrationWarning>
                  {card.value}
                </span>
              </div>
            </div>
          ))}

          {/* 지갑 몸통 — 스티치(점선) 포켓, 가운데 총 금액 */}
          <div className="absolute inset-x-0 bottom-0" style={{
            height: "180px", zIndex: 5, background: C.green900,
            borderRadius: "22px 22px 40px 40px",
            boxShadow: "inset 0 22px 30px rgba(0,0,0,.4), inset 0 4px 12px rgba(0,0,0,.3), 0 16px 34px rgba(28,36,24,.28)",
          }}>
            <div className="absolute flex flex-col items-center justify-center text-center"
              style={{
                inset: "12px", borderRadius: "14px 14px 32px 32px",
                border: "2px dashed rgba(233,196,106,.38)",
              }}>
              <div className="text-[10px] mb-2" style={{ fontFamily: MONO, letterSpacing: ".3em", color: C.sageLight }}>
                TOTAL — 총 결제 금액
              </div>
              <div className="text-[30px] lg:text-[36px] font-bold leading-none tnum" suppressHydrationWarning
                style={{ fontFamily: MONO, color: C.gold }}>
                {complete ? WON(total) : "—"}
              </div>
              <div className="mt-2 text-[11px]" style={{ color: "rgba(199,214,192,.65)" }} suppressHydrationWarning>
                {complete
                  ? `${fmtDate(checkIn!)} — ${fmtDate(checkOut!)} · ${nights}박`
                  : "달력에서 날짜를 선택하면 금액이 표시돼요"}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">{summaryCta}</div>
          </div>
        </div>
      </div>

      {/* ── 요약 바 (모바일 전용, 하단 고정) ── */}
      <div className="lg:hidden sticky bottom-0 z-20" style={{ background: C.surfaceSoft, borderTop: `2px solid ${C.green800}` }}>
        <div className="px-5 py-3.5 flex flex-col gap-3">
          <div className="min-w-0">
            <div className="text-[10px] mb-0.5" style={{ letterSpacing: ".16em", color: C.sage }}>
              {complete ? "선택한 일정" : checkIn ? "퇴실 날짜" : "입실 날짜"}
            </div>
            <div className="font-bold text-[14px] truncate" style={{ color: C.green900 }} suppressHydrationWarning>
              {complete
                ? `${fmtDate(checkIn!)} — ${fmtDate(checkOut!)} · ${nights}박 · ${WON(total)}`
                : checkIn ? "퇴실 날짜를 선택하세요" : "달력에서 입실 날짜를 선택하세요"}
            </div>
            {complete && discountPct > 0 && (
              <div className="text-[11px] tnum mt-0.5" style={{ color: C.muted3 }}>
                <span className="line-through">{WON(listTotal)}</span>
                <span className="ml-1.5 font-bold" style={{ color: C.green700 }}>{discountPct}% 할인</span>
                <span className="ml-1.5">{pack.label} · {room}</span>
              </div>
            )}
          </div>
          {summaryCta}
        </div>
      </div>
    </div>
  );
}
