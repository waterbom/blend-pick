"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PACKAGES, ROOM_META, TIERS, getTier, nightlyWon, stayPriceWon, listWon, manLabel, nextISO,
  BOOKABLE_FROM, BOOKABLE_TO, GROUPBUY_DEADLINE, SALE_START, SALE_FROM, SALE_TO, ymdKor, mdKor, WON,
  type PkgKey, type RoomType,
} from "@/lib/hotel";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS = [7, 8, 9, 10]; // 2026 시즌
const YEAR = 2026;
const KAKAO_CHANNEL_URL = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL || "http://pf.kakao.com/_VyING/chat";
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function fmtDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  const dow = WEEKDAYS[new Date(iso).getDay()];
  return `${m}월 ${d}일 (${dow})`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

const md = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${m}/${d}`; };

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

export default function HotelReserveClient({
  influencerId,
  influencerName,
}: {
  influencerId?: string | null;
  influencerName?: string | null;
}) {
  const router = useRouter();
  const [pkg, setPkg] = useState<PkgKey>("p2");
  const [room, setRoom] = useState<RoomType>("디럭스 더블");
  const [monthIdx, setMonthIdx] = useState(0); // MONTHS 인덱스
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [soldOut, setSoldOut] = useState<Set<string>>(new Set());

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
  const sale: "before" | "open" | "closed" =
    now < new Date(SALE_START).getTime() ? "before"
    : now > new Date(GROUPBUY_DEADLINE).getTime() ? "closed" : "open";
  const remain = calcRemain(sale === "before" ? SALE_START : GROUPBUY_DEADLINE, now);

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

  const tabBtn = (active: boolean) =>
    `flex-1 py-3 rounded-xl text-sm font-bold transition-all ${active ? "text-white" : ""}`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
        여수 UTOP 마리나 호텔 공동구매
      </h1>
      <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>
        원하는 패키지와 날짜를 선택하면 요금이 자동으로 계산돼요.
      </p>

      {/* 공구 마감 카운트다운 + 투숙 가능 기간 */}
      <div className="mt-5 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 text-white" style={{ background: "var(--accent)" }}>
        <div className="min-w-0">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.72)" }}>
            {sale === "before" ? "판매 시작까지" : "공동구매 마감까지"}
          </p>
          <p className="text-2xl font-extrabold font-mono tnum mt-1" suppressHydrationWarning>
            {remain
              ? `${remain.d}일 ${pad(remain.h)}:${pad(remain.m)}:${pad(remain.s)}`
              : sale === "before" ? "잠시 후 오픈" : "마감되었습니다"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.72)" }}>투숙 가능 기간</p>
          <p className="text-lg font-extrabold tnum mt-1">{md(BOOKABLE_FROM)} ~ {md(BOOKABLE_TO)}</p>
        </div>
      </div>

      {/* 판매정보 */}
      <div className="mt-4 rounded-2xl p-4" style={{ border: "1.5px dashed var(--accent)", background: "var(--surface-soft)" }}>
        <p className="text-sm font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>■ 판매정보</p>
        <ul className="space-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          <li>1) 판매기간 : {ymdKor(SALE_FROM)} ~ {mdKor(SALE_TO)}</li>
          <li>2) 투숙기간 : {ymdKor(BOOKABLE_FROM)} ~ {mdKor(BOOKABLE_TO)}</li>
          <li>3) 연휴기간 : 하단 기간별 구분표 참조</li>
        </ul>
      </div>

      {/* 후킹 카피 */}
      <div className="mt-4 rounded-2xl p-5" style={{ background: "var(--accent-soft)", border: "1px solid var(--line)" }}>
        <p className="text-sm font-bold leading-relaxed" style={{ color: "var(--accent)" }}>
          룸온리 가격 수준에 조식 + 인피니티풀까지 다 넣은 이 구성..<br />
          {influencerName ?? "후다닥맘"} 독점이라 가능한 거예요! 🙅‍♀️ 다른 곳에선 절대 못 찾아요
        </p>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          여기에 미친 혜택까지 꽉꽉 채워왔으니, <b style={{ color: "var(--text-primary)" }}>이번 공구는 진심 놓치면 후회합니다!!</b>
        </p>
      </div>

      {/* 패키지 선택 */}
      <div className="mt-5">
        <p className="text-sm font-extrabold mb-2.5" style={{ color: "var(--text-primary)" }}>패키지 선택</p>
        <div className="flex gap-2">
          {(Object.keys(PACKAGES) as PkgKey[]).map((k) => {
            const on = pkg === k;
            return (
              <button
                key={k}
                onClick={() => choosePkg(k)}
                className={tabBtn(on)}
                style={{
                  background: on ? "var(--accent)" : "#fff",
                  color: on ? "#fff" : "var(--text-secondary)",
                  border: `1.5px solid ${on ? "var(--accent)" : "var(--line)"}`,
                }}
              >
                {PACKAGES[k].label}
              </button>
            );
          })}
        </div>

        {/* 패키지 구성 */}
        <div className="mt-3 rounded-2xl p-4" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)" }}>
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{pack.people} · {pack.rooms.join(" / ")}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {pack.includes.map((x) => (
              <li key={x} className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--accent)" }}>✓</span>{x}
              </li>
            ))}
          </ul>
          <p className="text-xs mt-2.5" style={{ color: "var(--text-muted)" }}>
            연박 시 조식·인피니티풀 매일 제공
          </p>
          <div className="mt-2.5 pt-2.5 space-y-1" style={{ borderTop: "1px dashed var(--line)" }}>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              · 인원 추가비: <b style={{ color: "var(--text-primary)" }}>3·4인 패키지 무료</b>, 2인 패키지 1인당 <b style={{ color: "var(--text-primary)" }}>10,000원</b>
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              · 특가 패키지 특성상 <b style={{ color: "var(--text-primary)" }}>침구 추가는 불가</b>한 점 양해 부탁드립니다
            </p>
          </div>
        </div>

        {/* 취소·환불 안내 (특가) */}
        <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2.5 rounded-2xl px-4 py-3 transition-transform active:scale-[0.99]"
          style={{ background: "#FEE500", color: "#191600" }}>
          <span className="text-lg">💬</span>
          <span className="text-xs font-bold leading-snug">
            특가 이벤트 상품으로 취소·환불은 카카오톡 채널로 문의 주시면 직접 도와드려요 →
          </span>
        </a>
      </div>

      {/* 객실 타입 */}
      <div className="mt-5">
        <p className="text-sm font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>객실 타입</p>
        <div className="flex gap-2">
          {pack.rooms.map((r) => {
            const on = room === r;
            return (
              <button key={r} onClick={() => { setRoom(r); resetDates(); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: on ? "var(--accent-soft)" : "#fff", color: on ? "var(--accent)" : "var(--text-secondary)", border: `1.5px solid ${on ? "var(--accent)" : "var(--line)"}` }}>
                {r}
              </button>
            );
          })}
        </div>

        {/* 선택 객실 사진 (public/hotel/room/ 에 넣으면 표시, 없으면 플레이스홀더) */}
        <div className="mt-3">
          <div className={`grid gap-2 ${rm.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {rm.images.map((src, i) => (
              <div key={src} className="relative rounded-2xl overflow-hidden aspect-[4/3]"
                style={{ background: "linear-gradient(135deg,#e8efe9,#cde0d5)", border: "1px solid var(--line)" }}>
                <span className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: "var(--text-muted)" }}>
                  {room} 사진 {i + 1}
                </span>
                <img src={src} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              </div>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            <b style={{ color: "var(--text-primary)" }}>{room}</b> · {rm.bed} · {rm.capacity}
          </p>
        </div>
      </div>

      {/* 시즌 범례 */}
      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5">
        {(Object.keys(TIERS) as (keyof typeof TIERS)[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="w-3 h-3 rounded" style={{ background: TIERS[t].chip, border: "1px solid var(--line)" }} />
            {TIERS[t].label}
          </span>
        ))}
      </div>

      {/* 달력 */}
      <div className="mt-3 rounded-2xl p-4" style={{ border: "1px solid var(--line)", background: "#fff" }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMonthIdx((i) => Math.max(0, i - 1))} disabled={monthIdx === 0}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg disabled:opacity-30 hover:bg-gray-50" style={{ color: "var(--text-secondary)" }}>‹</button>
          <p className="text-base font-extrabold" style={{ color: "var(--text-primary)" }}>{YEAR}년 {month}월</p>
          <button onClick={() => setMonthIdx((i) => Math.min(MONTHS.length - 1, i + 1))} disabled={monthIdx === MONTHS.length - 1}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg disabled:opacity-30 hover:bg-gray-50" style={{ color: "var(--text-secondary)" }}>›</button>
        </div>

        {!complete && (
          <p className="text-center text-xs mb-2 font-medium" style={{ color: "var(--accent)" }}>
            {checkIn ? "🏁 퇴실 날짜를 선택하세요" : "📅 입실 날짜를 선택하세요"}
          </p>
        )}

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className="text-center text-xs font-semibold py-1.5"
              style={{ color: i === 0 ? "#dc2626" : i === 6 ? "#2563eb" : "var(--text-muted)" }}>{w}</div>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <div key={`e${i}`} />;
            const [, , d] = iso.split("-").map(Number);
            const inRange = iso >= BOOKABLE_FROM && iso <= BOOKABLE_TO;
            const canPick = selectable(iso);
            const sold = inRange && soldOut.has(iso);
            const tier = getTier(iso);
            const isIn = iso === checkIn;
            const isOut = iso === checkOut;
            const isMid = !!(checkIn && checkOut && iso > checkIn && iso < checkOut);
            const endpoint = isIn || isOut;

            return (
              <button
                key={iso}
                disabled={!canPick}
                onClick={() => onDateClick(iso)}
                className="aspect-square rounded-lg flex flex-col items-center justify-center text-center transition-all"
                style={{
                  background: endpoint ? "var(--accent)" : isMid ? "var(--accent-soft)" : inRange ? TIERS[tier].bg : "transparent",
                  border: endpoint ? "1.5px solid var(--accent)" : isMid ? "1px solid var(--accent-soft)" : inRange ? "1px solid var(--line)" : "1px solid transparent",
                  color: endpoint ? "#fff" : isMid ? "var(--accent)" : inRange ? "var(--text-primary)" : "var(--text-muted)",
                  opacity: !inRange ? 0.35 : !canPick ? 0.5 : 1,
                  cursor: canPick ? "pointer" : "default",
                }}
              >
                <span className="text-xs font-bold leading-none">{d}</span>
                {inRange && (
                  endpoint ? (
                    <span className="text-[10px] mt-0.5 font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>{isIn ? "입실" : "퇴실"}</span>
                  ) : sold ? (
                    <span className="text-[10px] mt-0.5 font-bold" style={{ color: "#dc2626" }}>마감</span>
                  ) : canPick ? (
                    <span className="text-[10px] mt-0.5 tnum" style={{ color: isMid ? "var(--accent)" : TIERS[tier].text }}>
                      {manLabel(nightlyWon(pkg, iso))}
                    </span>
                  ) : null
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 혜택 */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)", color: "var(--text-secondary)" }}>
          👶 <b style={{ color: "var(--text-primary)" }}>36개월 미만 무료</b>
        </div>
        <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)", color: "var(--text-secondary)" }}>
          💯 <b style={{ color: "var(--text-primary)" }}>체크인 6일 전 100% 환불</b>
        </div>
      </div>

      {/* 예약 요약 + 버튼 (하단 고정) */}
      <div className="sticky bottom-0 mt-6 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 pb-4"
        style={{ background: "linear-gradient(to top, var(--background) 78%, transparent)" }}>
        <div className="rounded-2xl p-4 bg-white" style={{ border: "1px solid var(--line)", boxShadow: "var(--card-shadow)" }}>
          {complete ? (
            <div className="flex items-center justify-between mb-3 text-sm">
              <div style={{ color: "var(--text-secondary)" }}>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmtDate(checkIn!)}</span>
                {" ~ "}
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmtDate(checkOut!)}</span>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{nights}박 · {pack.label} · {room}</div>
              </div>
              <div className="text-right shrink-0">
                {discountPct > 0 && (
                  <div className="text-xs tnum">
                    <span className="line-through" style={{ color: "var(--text-muted)" }}>{WON(listTotal)}</span>
                    <span className="ml-1 font-extrabold" style={{ color: "var(--sale)" }}>{discountPct}%</span>
                  </div>
                )}
                <span className="text-lg font-extrabold tnum" style={{ color: "var(--accent)" }}>{WON(total)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-center mb-3" style={{ color: "var(--text-muted)" }}>
              {checkIn ? "퇴실 날짜를 선택하세요" : "달력에서 입실 날짜를 선택하세요"}
            </p>
          )}
          <button
            disabled={!complete || sale !== "open"}
            onClick={() => {
              if (!complete || sale !== "open") return;
              const infParam = influencerId ? `&inf=${influencerId}` : "";
              router.push(`/hotel/reserve/checkout?pkg=${pkg}&room=${encodeURIComponent(room)}&in=${checkIn}&out=${checkOut}${infParam}`);
            }}
            className="w-full py-4 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            {sale === "before" ? "오늘 오전 11시 오픈"
              : sale === "closed" ? "판매가 마감되었어요"
              : complete ? `예약하기 · ${WON(total)}` : "날짜를 선택하세요"}
          </button>
        </div>
      </div>
    </div>
  );
}
