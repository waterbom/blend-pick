"use client";
import { useEffect, useState } from "react";

const DIGITS = Array.from({ length: 10 }, (_, i) => String(i));

/**
 * 금액 숫자 롤링 — 자리별 숫자 릴을 한 바퀴 굴려 멈춘다 (라이브러리 없이 CSS transition).
 * 오른쪽 자리가 먼저 멈추도록 딜레이를 역순으로 줘 "띄리리링" 리듬이 생긴다.
 * 값이 0이면 "———원" 플레이스홀더.
 */
export default function RollingWon({
  value, size = 34, color = "#E9C46A",
}: { value: number; size?: number; color?: string }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => { setPhase((p) => (p ? 0 : 1)); }, [value]); // 값이 바뀔 때마다 반대 방향으로 한 바퀴

  const text = value > 0 ? `${value.toLocaleString()}원` : "———원";
  const chars = text.split("");

  return (
    <span style={{ display: "flex", alignItems: "flex-start", fontFamily: "'IBM Plex Mono', monospace",
      fontWeight: 600, fontSize: size, lineHeight: 1, color }} suppressHydrationWarning>
      {chars.map((ch, i) => {
        const isDigit = ch >= "0" && ch <= "9";
        const column = isDigit ? [...DIGITS, ...DIGITS] : [ch, ch];
        const y = isDigit ? `-${(phase ? 10 : 0) + Number(ch)}em` : "0em";
        return (
          <span key={i} style={{ display: "block", height: "1em", overflow: "hidden",
            width: isDigit ? ".62em" : ch === "," ? ".34em" : "1em" }}>
            <span className="roll-col" style={{ display: "block", transform: `translateY(${y})`,
              transition: "transform 1.05s cubic-bezier(.16,1,.3,1)",
              transitionDelay: `${(chars.length - 1 - i) * 55}ms` }}>
              {column.map((d, k) => (
                <span key={k} style={{ display: "block", height: "1em", textAlign: "center" }}>{d}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
