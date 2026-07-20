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

// PRODUCTS 하단 "진행 중 공구" 밴드 — 지금 열려 있는 인플루언서 공구를 DB 기준으로 표시
// active가 비어 있으면 마감 안내 (일정은 관리자 > 인플루언서에서 관리)
export default function HotelPromoBand({
  active = [],
}: {
  active?: { id: string; name: string; deadline: string }[];
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const open = active.length > 0;
  const names = active.map((a) => a.name).join(" · ");
  // 카운트다운은 가장 먼저 끝나는 공구 기준
  const diff = open ? Math.max(0, new Date(active[0].deadline).getTime() - now) : 0;
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
        <div className="text-[10px] mb-2" style={{ fontFamily: MONO, fontWeight: 600, letterSpacing: ".28em", color: open ? "#A65B4B" : "#9A9482" }}>
          {open ? (
            <span className="neon-live">
              <span className="neon-dot">●</span> LIVE — 지금 진행 중
            </span>
          ) : (
            "HOTEL 공동구매"
          )}
        </div>
        <div className="text-[17px] lg:text-[20px]" style={{ fontFamily: SERIF, fontWeight: 700, color: "#1C2418" }}>
          호텔공구 × 여수 UTOP 마리나 호텔
        </div>
        <div className="mt-1.5 text-[12px] lg:text-[13px]" style={{ color: "#5C6153" }} suppressHydrationWarning>
          {open ? (
            <>
              <b style={{ color: "#244B1F" }}>{names}</b> 공구 진행 중 · 종료까지{" "}
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
