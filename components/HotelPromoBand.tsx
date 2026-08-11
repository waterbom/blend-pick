"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const SERIF = "'Noto Serif KR', serif";
const pad = (n: number) => String(n).padStart(2, "0");

// "하블리네로" / "민경으로" — 받침 유무에 따른 조사 선택 (ㄹ 받침은 '로')
function roParticle(name: string) {
  const code = name.charCodeAt(name.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return "로";
  const jong = (code - 0xac00) % 28;
  return jong === 0 || jong === 8 ? "로" : "으로";
}

// "2026-07-22T10:00:00+09:00" (KST 표기) → "7/22(수) 10:00"
function fmtOpenAt(iso: string) {
  const [y, m, day] = iso.slice(0, 10).split("-").map(Number);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return `${m}/${day}(${dow}) ${iso.slice(11, 16)}`;
}

// PRODUCTS 하단 "진행 중 공구" 밴드 — 지금 열려 있는 인플루언서 공구를 DB 기준으로 표시
// active가 비면 upcoming(오픈 예정)을 커밍순으로, 그것도 없으면 마감 안내
export default function HotelPromoBand({
  active = [],
  upcoming = [],
}: {
  active?: { id: string; name: string; deadline: string }[];
  upcoming?: { id: string; name: string; start: string }[];
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const open = active.length > 0;
  const soon = !open && upcoming.length > 0;
  const names = active.map((a) => a.name).join(" · ");
  // 카운트다운: 진행 중이면 가장 먼저 끝나는 공구의 종료까지, 커밍순이면 가장 임박한 오픈까지
  const target = open ? active[0].deadline : soon ? upcoming[0].start : null;
  const diff = target ? Math.max(0, new Date(target).getTime() - now) : 0;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 p-6 lg:py-7 lg:px-9 rounded-2xl"
      style={{
        background: "linear-gradient(120deg, #FBF4E0 0%, #F3E8C6 55%, #EAF0E6 100%)",
        border: "1px solid #E9DDB8",
        color: "#1C2418",
      }}>
      <div>
        {open && (
          <style>{`
            @keyframes neonGlow {
              0%, 100% { text-shadow: 0 0 3px rgba(166,91,75,.9), 0 0 9px rgba(198,106,86,.65), 0 0 18px rgba(214,120,96,.4), 0 0 30px rgba(214,120,96,.22); opacity: 1; }
              8%       { text-shadow: 0 0 2px rgba(166,91,75,.5), 0 0 5px rgba(198,106,86,.3); opacity: .8; }
              10%      { text-shadow: 0 0 3px rgba(166,91,75,.9), 0 0 9px rgba(198,106,86,.65), 0 0 18px rgba(214,120,96,.4), 0 0 30px rgba(214,120,96,.22); opacity: 1; }
              50%      { text-shadow: 0 0 4px rgba(166,91,75,1), 0 0 12px rgba(198,106,86,.8), 0 0 24px rgba(214,120,96,.5), 0 0 40px rgba(214,120,96,.3); opacity: 1; }
            }
            @keyframes neonDot {
              0%, 100% { text-shadow: 0 0 4px rgba(166,91,75,1), 0 0 10px rgba(214,120,96,.9), 0 0 20px rgba(214,120,96,.6); opacity: 1; }
              50%      { text-shadow: 0 0 2px rgba(166,91,75,.4); opacity: .35; }
            }
            .neon-live { animation: neonGlow 2.6s ease-in-out infinite; }
            .neon-dot  { animation: neonDot 1.3s ease-in-out infinite; }
          `}</style>
        )}
        <div className="text-[10px] mb-2" style={{ fontFamily: MONO, fontWeight: 600, letterSpacing: ".28em", color: open ? "#A65B4B" : soon ? "#A67C1B" : "#9A9482" }}>
          {open ? (
            <span className="neon-live">
              <span className="neon-dot">●</span> LIVE — 지금 진행 중
            </span>
          ) : soon ? (
            "◷ COMING SOON — 오픈 예정"
          ) : (
            "STAY 공동구매"
          )}
        </div>
        <div className="text-[17px] lg:text-[20px]" style={{ fontFamily: SERIF, fontWeight: 700, color: "#1C2418" }}>
          숙박공구 — 호텔부터 펜션까지
        </div>
        <div className="mt-1.5 text-[12px] lg:text-[13px]" style={{ color: "#5C6153" }} suppressHydrationWarning>
          {open ? (
            <>
              <b style={{ color: "#244B1F" }}>{names}</b> 공구 진행 중 · 종료까지{" "}
              <span style={{ fontFamily: MONO, fontWeight: 700, color: "#A67C1B" }}>
                {d}일 {pad(h)}:{pad(m)}:{pad(s)}
              </span>
            </>
          ) : soon ? (
            <>
              <b style={{ color: "#244B1F" }}>{upcoming[0].name}</b> 공구 {fmtOpenAt(upcoming[0].start)} 오픈 · 오픈까지{" "}
              <span style={{ fontFamily: MONO, fontWeight: 700, color: "#A67C1B" }}>
                {d}일 {pad(h)}:{pad(m)}:{pad(s)}
              </span>
            </>
          ) : (
            "이번 공구가 마감되었습니다 · 다음 오픈을 기다려주세요"
          )}
        </div>
      </div>
      {open ? (
        // 진행 중 인플루언서의 전용 링크로 연결 — 귀속(inf)까지 그대로 이어짐
        <div className="flex flex-col sm:flex-row gap-2.5">
          {active.map((a) => (
            <Link key={a.id} href={`/hotel/reserve?inf=${a.id}`}
              className="inline-block text-center px-8 py-3 lg:py-[13px] text-[13px] lg:text-[13.5px] font-bold rounded-xl transition-all duration-150 hover:brightness-110"
              style={{ background: "#244B1F", color: "#fff" }}>
              {a.name}{roParticle(a.name)} 이동하기 →
            </Link>
          ))}
        </div>
      ) : soon ? (
        // 오픈 예정 공구의 전용 링크로 — 랜딩에서 오픈 카운트다운 표시
        <div className="flex flex-col sm:flex-row gap-2.5">
          {upcoming.map((u) => (
            <Link key={u.id} href={`/hotel/reserve?inf=${u.id}`}
              className="inline-block text-center px-8 py-3 lg:py-[13px] text-[13px] lg:text-[13.5px] font-bold rounded-xl transition-all duration-150 hover:brightness-110"
              style={{ background: "#E9C46A", color: "#1C2418" }}>
              COMING SOON — {u.name} 공구 →
            </Link>
          ))}
        </div>
      ) : (
        <Link href="/hotel/reserve"
          className="inline-block text-center px-8 py-3 lg:py-[13px] text-[13px] lg:text-[13.5px] font-bold rounded-xl transition-all duration-150 hover:brightness-110"
          style={{ background: "#244B1F", color: "#fff" }}>
          예약 조회 →
        </Link>
      )}
    </div>
  );
}
