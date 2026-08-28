"use client";

import { useEffect, useMemo, useState } from "react";
import { stayOfRoomType, type StayKey } from "@/lib/stay-admin";

interface Inv {
  date: string;
  room_type: string;
  allocated: number;
  booked: number;
  remaining: number;
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

// 객실 단계 색 — 한눈에 여유/임박/마감이 구분되도록 통일된 팔레트
function cellTone(c: Inv | undefined) {
  if (!c || c.allocated === 0) return { label: "–", cls: "bg-gray-50 text-gray-300" };
  if (c.remaining <= 0) return { label: "마감", cls: "bg-red-50 text-red-600" };
  if (c.remaining <= 2) return { label: `${c.remaining}`, cls: "bg-amber-50 text-amber-700" };
  return { label: `${c.remaining}`, cls: "bg-emerald-50 text-emerald-700" };
}

// "디럭스 더블" → "더블", "패밀리 트윈" → "트윈"
const shortRoom = (room: string) => room.split(" ").pop() || room;

function md(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}(${WEEK[new Date(y, m - 1, d).getDay()]})`;
}

export default function RoomInventoryClient({ stay = "" }: { stay?: "" | StayKey }) {
  const [invAll, setInvAll] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<string>(""); // "2026-07"
  const [mode, setMode] = useState<"calendar" | "list">("calendar");
  const [listFilter, setListFilter] = useState<"all" | "booked" | "tight">("all");

  useEffect(() => {
    fetch("/api/admin/reservations/inventory")
      .then((r) => r.json())
      .then((d) => {
        const rows: Inv[] = Array.isArray(d) ? d : [];
        setInvAll(rows);
        // 기본 선택 월 — 오늘이 포함된 월이 있으면 그 월, 없으면 첫 월
        const months = Array.from(new Set(rows.map((i) => i.date.slice(0, 7)))).sort();
        const today = new Date().toISOString().slice(0, 7);
        setMonth(months.includes(today) ? today : months[0] ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // 숙소 필터 — room_type으로 숙소를 판별해 선택 숙소의 재고만 남긴다
  const inv = useMemo(
    () => (stay ? invAll.filter((i) => stayOfRoomType(i.room_type) === stay) : invAll),
    [invAll, stay]
  );

  const view = useMemo(() => {
    const rooms = Array.from(new Set(inv.map((i) => i.room_type)));
    const byDate = new Map<string, Record<string, Inv>>();
    for (const i of inv) {
      if (!byDate.has(i.date)) byDate.set(i.date, {});
      byDate.get(i.date)![i.room_type] = i;
    }
    const allDates = Array.from(byDate.keys()).sort();
    const months = Array.from(new Set(allDates.map((d) => d.slice(0, 7)))).sort();
    const dates = month ? allDates.filter((d) => d.startsWith(month)) : allDates;

    // 선택 월 요약 — 객실별 잔여/배정/예약 합, 마감 일수, 임박 일수
    const totals: Record<string, { remaining: number; allocated: number; booked: number; soldOutDays: number; tightDays: number }> = {};
    for (const d of dates) {
      for (const rm of rooms) {
        const c = byDate.get(d)![rm];
        if (!c) continue;
        const t = (totals[rm] ??= { remaining: 0, allocated: 0, booked: 0, soldOutDays: 0, tightDays: 0 });
        t.remaining += c.remaining;
        t.allocated += c.allocated;
        t.booked += c.booked;
        if (c.allocated > 0 && c.remaining <= 0) t.soldOutDays++;
        else if (c.allocated > 0 && c.remaining <= 2) t.tightDays++;
      }
    }
    return { rooms, byDate, dates, months, totals };
  }, [inv, month]);

  // 달력 셀 — 선택 월의 1일~말일 전체 (재고 없는 날도 칸은 그림)
  const calendar = useMemo(() => {
    if (!month) return null;
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: (string | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${month}-${String(d).padStart(2, "0")}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const todayISO = new Date().toISOString().slice(0, 10);

  const listDates = useMemo(() => {
    let dates = view.dates;
    if (listFilter === "booked") dates = dates.filter((d) => view.rooms.some((rm) => (view.byDate.get(d)![rm]?.booked ?? 0) > 0));
    if (listFilter === "tight") dates = dates.filter((d) => view.rooms.some((rm) => {
      const c = view.byDate.get(d)![rm];
      return c && c.allocated > 0 && c.remaining <= 2;
    }));
    return dates;
  }, [view, listFilter]);

  if (loading) {
    return <div className="bg-white rounded-none border border-gray-100 p-16 text-center text-sm text-gray-400">재고 불러오는 중...</div>;
  }
  if (inv.length === 0) {
    return (
      <div className="bg-white rounded-none border border-gray-100 p-16 text-center text-sm text-gray-400">
        {stay ? "이 숙소의 객실 재고가 아직 등록되지 않았어요" : "재고 데이터가 없습니다"}
      </div>
    );
  }

  return (
    <div>
      {/* 월 탭 + 달력/목록 전환 */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex gap-1 bg-white rounded-none border border-gray-100 p-1 w-fit flex-wrap">
          {view.months.map((m) => (
            <button key={m} onClick={() => setMonth(m)}
              className={`px-4 py-1.5 rounded-none text-xs font-semibold transition-colors ${
                month === m ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              {Number(m.slice(0, 4))}년 {Number(m.slice(5))}월
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white rounded-none border border-gray-100 p-1">
          {([["calendar", "🗓 달력"], ["list", "☰ 목록"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)}
              className={`px-3.5 py-1.5 rounded-none text-xs font-semibold transition-colors ${
                mode === k ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 선택 월 요약 */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {view.rooms.map((rm) => {
          const t = view.totals[rm];
          if (!t) return null;
          const pct = t.allocated > 0 ? Math.round((t.booked / t.allocated) * 100) : 0;
          return (
            <div key={rm} className="bg-white rounded-none border border-gray-100 px-4 py-2.5 text-xs text-gray-500">
              <div className="flex items-center gap-3">
                <b className="text-gray-800">{rm}</b>
                <span>잔여 <b className="text-gray-800 tnum">{t.remaining}</b>실</span>
                <span className="text-red-600">마감 <b className="tnum">{t.soldOutDays}</b>일</span>
                <span className="text-amber-600">임박(1~2) <b className="tnum">{t.tightDays}</b>일</span>
              </div>
              {/* 이 달 전체 예약률 게이지 */}
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400"}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <span className="tnum text-[11px] text-gray-400">예약률 <b className="text-gray-600">{pct}%</b></span>
              </div>
            </div>
          );
        })}
        {/* 범례 */}
        <div className="bg-white rounded-none border border-gray-100 px-4 py-2.5 text-[11px] text-gray-400 flex items-center gap-2.5 ml-auto">
          <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-100 inline-block" />여유</span>
          <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-amber-100 inline-block" />임박(1~2)</span>
          <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-red-100 inline-block" />마감</span>
          <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-gray-100 inline-block" />배정 없음</span>
        </div>
      </div>

      {mode === "calendar" && calendar ? (
        // 모바일에서도 7일이 한 화면에 들어가도록 셀 폭·글자 크기를 반응형으로 압축
        <div className="bg-white rounded-none border border-gray-100">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
            {WEEK.map((w, i) => (
              <div key={w} className={`py-2 text-center text-xs font-semibold ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-400"}`}>
                {w}
              </div>
            ))}
          </div>
          {/* 날짜 셀 */}
          <div className="grid grid-cols-7">
            {calendar.map((d, i) => {
              if (!d) return <div key={`e${i}`} className="border-b border-r border-gray-50 bg-gray-50/40 min-h-[64px] sm:min-h-[76px]" />;
              const dow = i % 7;
              const dayInv = view.byDate.get(d);
              const isToday = d === todayISO;
              return (
                <div key={d}
                  className={`border-b border-r border-gray-50 min-h-[64px] sm:min-h-[76px] p-1 sm:p-1.5 min-w-0 ${dow === 0 || dow === 6 ? "bg-amber-50/30" : ""} ${isToday ? "ring-2 ring-inset ring-gray-800" : ""}`}>
                  <div className={`text-[10px] sm:text-[11px] font-semibold tnum mb-1 ${
                    dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-gray-500"}`}>
                    {Number(d.slice(8))}{isToday && <span className="ml-1 text-[9px] text-gray-800">오늘</span>}
                  </div>
                  {dayInv ? (
                    <div className="space-y-0.5 sm:space-y-1">
                      {view.rooms.map((rm) => {
                        const c = dayInv[rm];
                        const tone = cellTone(c);
                        return (
                          <div key={rm}
                            className={`flex items-center justify-between gap-0.5 rounded-sm px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold tnum ${tone.cls}`}
                            title={c ? `${rm} — 남음 ${c.remaining} / 배정 ${c.allocated} · 예약 ${c.booked}` : `${rm} — 배정 없음`}>
                            <span className="font-medium truncate">{shortRoom(rm)}</span>
                            <span className="shrink-0">{tone.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-300">–</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* 목록 필터 */}
          <div className="flex gap-2 mb-3">
            {([["all", "전체 날짜"], ["booked", "예약 있는 날"], ["tight", "마감·임박만"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setListFilter(k)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  listFilter === k ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-none border border-gray-100 overflow-hidden">
            {/* 열 헤더는 그리드가 되는 sm 이상에서만 — 모바일은 행마다 객실 라벨을 붙임 */}
            <div className="hidden sm:grid gap-6 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-400" style={{ gridTemplateColumns: `0.6fr repeat(${view.rooms.length}, 1fr)` }}>
              <span>투숙일</span>
              {view.rooms.map((rm) => <span key={rm}>{rm}</span>)}
            </div>
            <div className="max-h-[32rem] overflow-auto">
              {listDates.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-400">조건에 맞는 날짜가 없습니다 — 필터를 바꿔보세요</div>
              ) : (
                listDates.map((d) => {
                  const dow = new Date(d).getDay();
                  // 하루라도 마감 객실이 있으면 행 전체를 붉게 틴트해서 바로 눈에 띄게
                  const anySoldOut = view.rooms.some((rm) => {
                    const c = view.byDate.get(d)?.[rm];
                    return c && c.allocated > 0 && c.remaining <= 0;
                  });
                  return (
                    <div key={d}
                      className={`flex flex-col gap-1.5 sm:grid sm:gap-6 sm:items-center px-4 sm:px-6 py-2.5 border-b border-gray-50 last:border-0 text-sm ${
                        anySoldOut ? "bg-red-50/40" : dow === 0 || dow === 6 ? "bg-amber-50/40" : ""}`}
                      style={{ gridTemplateColumns: `0.6fr repeat(${view.rooms.length}, 1fr)` }}>
                      <span className={`tnum font-semibold ${dow === 0 ? "text-red-600" : dow === 6 ? "text-blue-600" : "text-gray-600"}`}>
                        {md(d)}
                      </span>
                      {view.rooms.map((rm) => {
                        const c = view.byDate.get(d)?.[rm];
                        if (!c || c.allocated === 0) {
                          return (
                            <span key={rm} className="text-xs text-gray-300">
                              <span className="sm:hidden w-8 inline-block text-gray-400">{shortRoom(rm)}</span>배정 없음
                            </span>
                          );
                        }
                        const tone = cellTone(c);
                        const soldOut = c.remaining <= 0;
                        const low = !soldOut && c.remaining <= 2;
                        const pct = Math.min(100, Math.round((c.booked / c.allocated) * 100));
                        return (
                          <div key={rm} className="flex items-center gap-2 sm:gap-2.5"
                            title={`${rm} — 남음 ${c.remaining} / 배정 ${c.allocated} · 예약 ${c.booked}`}>
                            {/* 모바일 전용 객실 라벨 (열 헤더 대신) */}
                            <span className="sm:hidden shrink-0 w-8 text-[11px] text-gray-400">{shortRoom(rm)}</span>
                            <span className={`shrink-0 w-12 text-center rounded-sm px-1 py-0.5 text-[11px] font-bold tnum ${tone.cls}`}>
                              {soldOut ? "마감" : `${c.remaining}실`}
                            </span>
                            {/* 예약률 게이지 — 채워질수록 방이 빠지는 중, 색으로 위험도 표시 */}
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${soldOut ? "bg-red-400" : low ? "bg-amber-400" : "bg-emerald-400"}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className="shrink-0 w-16 text-right text-[11px] text-gray-400 tnum">
                              예약 {c.booked}<span className="text-gray-300"> / {c.allocated}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
