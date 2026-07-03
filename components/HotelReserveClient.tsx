"use client";

import { useState, useMemo } from "react";
import {
  PACKAGES, ROOM_META, TIERS, getTier, nightlyWon, stayPriceWon, listWon, maxNightsFrom, manLabel, isSoldOut, nextISO,
  BOOKABLE_FROM, BOOKABLE_TO, WON,
  type PkgKey, type RoomType,
} from "@/lib/hotel";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS = [7, 8, 9, 10]; // 2026 시즌
const YEAR = 2026;
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function fmtDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  const dow = WEEKDAYS[new Date(iso).getDay()];
  return `${m}월 ${d}일 (${dow})`;
}

export default function HotelReserveClient() {
  const [pkg, setPkg] = useState<PkgKey>("p2");
  const [room, setRoom] = useState<RoomType>("디럭스 더블");
  const [nights, setNights] = useState(1);
  const [monthIdx, setMonthIdx] = useState(0); // MONTHS 인덱스
  const [selected, setSelected] = useState<string | null>(null);

  const pack = PACKAGES[pkg];
  const rm = ROOM_META[room];
  const month = MONTHS[monthIdx];

  function choosePkg(k: PkgKey) {
    setPkg(k);
    setRoom(PACKAGES[k].rooms[0]); // 패키지 바꾸면 항상 해당 패키지 기본 객실로
    setSelected(null);
    setNights(1);
  }

  // 입실 가능 여부 (예약기간 내 + 해당 밤 재고 있음)
  function selectable(iso: string): boolean {
    return iso >= BOOKABLE_FROM && iso <= BOOKABLE_TO && !isSoldOut(room, iso);
  }

  const cells = useMemo(() => {
    const first = new Date(YEAR, month - 1, 1).getDay();
    const days = new Date(YEAR, month, 0).getDate();
    const arr: (string | null)[] = [];
    for (let i = 0; i < first; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(isoOf(YEAR, month, d));
    return arr;
  }, [month]);

  const maxNights = selected ? maxNightsFrom(room, selected) : 1;
  const total = selected ? stayPriceWon(pkg, selected, nights) : 0;
  const listTotal = selected ? listWon(pkg, room, nights) : 0;
  const discountPct = listTotal > total && listTotal > 0 ? Math.round((1 - total / listTotal) * 100) : 0;
  const checkout = selected
    ? (() => { let c = selected; for (let i = 0; i < nights; i++) c = nextISO(c); return c; })()
    : null;

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

      {/* 후킹 카피 */}
      <div className="mt-5 rounded-2xl p-5" style={{ background: "var(--accent-soft)", border: "1px solid var(--line)" }}>
        <p className="text-sm font-bold leading-relaxed" style={{ color: "var(--accent)" }}>
          룸온리 가격 수준에 조식 + 인피니티풀까지 다 넣은 이 구성..<br />
          후다닥맘 독점이라 가능한 거예요! 🙅‍♀️ 다른 곳에선 절대 못 찾아요
        </p>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          여기에 미친 혜택까지 꽉꽉 채워왔으니, <b style={{ color: "var(--text-primary)" }}>이번 공구는 진심 놓치면 후회합니다!!</b>
        </p>
      </div>

      {/* 선택 객실 사진 (public/hotel/room/ 에 넣으면 표시, 없으면 플레이스홀더) */}
      <div className="mt-5">
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
        </div>
      </div>

      {/* 객실 + 박수 */}
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>객실 타입</p>
          <div className="flex gap-2">
            {pack.rooms.map((r) => {
              const on = room === r;
              return (
                <button key={r} onClick={() => { setRoom(r); setSelected(null); setNights(1); }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: on ? "var(--accent-soft)" : "#fff", color: on ? "var(--accent)" : "var(--text-secondary)", border: `1.5px solid ${on ? "var(--accent)" : "var(--line)"}` }}>
                  {r}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-sm font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>숙박</p>
          <div className="flex items-center justify-between rounded-xl px-1.5 py-1.5" style={{ border: "1.5px solid var(--line)", background: "#fff" }}>
            <button onClick={() => setNights((n) => Math.max(1, n - 1))} disabled={!selected || nights <= 1}
              className="w-9 h-9 flex items-center justify-center text-lg rounded-lg disabled:opacity-30 hover:bg-gray-50" style={{ color: "var(--text-secondary)" }} aria-label="박수 감소">−</button>
            <span className="text-sm font-bold tnum" style={{ color: selected ? "var(--text-primary)" : "var(--text-muted)" }}>{selected ? nights : 1}박</span>
            <button onClick={() => setNights((n) => Math.min(maxNights, n + 1))} disabled={!selected || nights >= maxNights}
              className="w-9 h-9 flex items-center justify-center text-lg rounded-lg disabled:opacity-30 hover:bg-gray-50" style={{ color: "var(--text-secondary)" }} aria-label="박수 증가">+</button>
          </div>
          {selected && maxNights < 30 && (
            <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>최대 {maxNights}박 (재고 기준)</p>
          )}
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
            const sold = inRange && isSoldOut(room, iso);
            const tier = getTier(iso);
            const on = selected === iso;

            return (
              <button
                key={iso}
                disabled={!canPick}
                onClick={() => { setSelected(iso); setNights(1); }}
                className="aspect-square rounded-lg flex flex-col items-center justify-center text-center transition-all"
                style={{
                  background: on ? "var(--accent)" : inRange ? TIERS[tier].bg : "transparent",
                  border: on ? "1.5px solid var(--accent)" : inRange ? "1px solid var(--line)" : "1px solid transparent",
                  color: on ? "#fff" : inRange ? "var(--text-primary)" : "var(--text-muted)",
                  opacity: !inRange ? 0.35 : sold || !canPick ? 0.5 : 1,
                  cursor: canPick ? "pointer" : "default",
                }}
              >
                <span className="text-xs font-bold leading-none">{d}</span>
                {inRange && (
                  sold ? (
                    <span className="text-[10px] mt-0.5 font-bold" style={{ color: on ? "#fff" : "#dc2626" }}>마감</span>
                  ) : canPick ? (
                    <span className="text-[10px] mt-0.5 tnum" style={{ color: on ? "rgba(255,255,255,0.9)" : TIERS[tier].text }}>
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
          {selected ? (
            <div className="flex items-center justify-between mb-3 text-sm">
              <div style={{ color: "var(--text-secondary)" }}>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmtDate(selected)}</span>
                {" "}입실 · {nights}박 · {pack.label} · {room}
                {checkout && <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{fmtDate(checkout)} 퇴실</div>}
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
            <p className="text-sm text-center mb-3" style={{ color: "var(--text-muted)" }}>달력에서 입실 날짜를 선택하세요</p>
          )}
          <button
            disabled={!selected}
            onClick={() => alert(`선택 내역\n\n${pack.label} · ${room}\n${fmtDate(selected!)} 입실 · ${nights}박\n총 ${WON(total)}\n\n(결제 연동은 다음 단계에서 붙일게요)`)}
            className="w-full py-4 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            {selected ? `예약하기 · ${WON(total)}` : "날짜를 선택하세요"}
          </button>
        </div>
      </div>
    </div>
  );
}
