"use client";

/**
 * 7세그먼트 네온 카운트다운 — 라이브러리·이미지 없이 CSS만으로 디지털 시계 모양을 그린다.
 * 각 숫자는 7개의 막대(세그먼트)로 이루어지고, 숫자마다 켤 막대를 골라 불을 붙인다.
 * 색은 부모의 color(currentColor)를 그대로 따라가므로 페이지 톤에 맞춰 쓰면 된다.
 */

// 숫자 → 켜지는 세그먼트 (a=위, b=우상, c=우하, d=아래, e=좌하, f=좌상, g=가운데)
const SEG: Record<string, string> = {
  "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc",
  "5": "afgcd", "6": "afgcde", "7": "abc", "8": "abcdefg", "9": "abcdfg",
};

// 세그먼트별 위치 (컨테이너 0.62em × 1.1em 기준, 두께 0.1em)
const POS: Record<string, React.CSSProperties> = {
  a: { top: 0, left: "0.09em", right: "0.09em", height: "0.1em" },
  g: { top: "0.5em", left: "0.09em", right: "0.09em", height: "0.1em" },
  d: { bottom: 0, left: "0.09em", right: "0.09em", height: "0.1em" },
  f: { top: "0.07em", left: 0, width: "0.1em", height: "0.46em" },
  b: { top: "0.07em", right: 0, width: "0.1em", height: "0.46em" },
  e: { bottom: "0.07em", left: 0, width: "0.1em", height: "0.46em" },
  c: { bottom: "0.07em", right: 0, width: "0.1em", height: "0.46em" },
};

function Digit({ ch }: { ch: string }) {
  const lit = SEG[ch] ?? "";
  return (
    <span className="relative inline-block" style={{ width: "0.62em", height: "1.1em" }} aria-hidden>
      {Object.keys(POS).map((s) => {
        const on = lit.includes(s);
        return (
          <span key={s} className="absolute" style={{
            ...POS[s],
            borderRadius: "0.05em",
            background: "currentColor",
            opacity: on ? 1 : 0.09, // 꺼진 막대도 희미하게 남겨 진짜 전광판 느낌
            filter: on ? "drop-shadow(0 0 0.06em currentColor) drop-shadow(0 0 0.18em currentColor)" : "none",
            transition: "opacity .18s ease",
          }} />
        );
      })}
    </span>
  );
}

function Colon() {
  return (
    <span className="relative inline-block neon-colon" style={{ width: "0.22em", height: "1.1em" }} aria-hidden>
      {["0.28em", "0.72em"].map((top) => (
        <span key={top} className="absolute left-1/2 -translate-x-1/2" style={{
          top, width: "0.1em", height: "0.1em", borderRadius: "50%",
          background: "currentColor",
          filter: "drop-shadow(0 0 0.06em currentColor) drop-shadow(0 0 0.18em currentColor)",
        }} />
      ))}
    </span>
  );
}

function Group({ value, label, minDigits = 2 }: { value: number; label: string; minDigits?: number }) {
  const str = String(Math.max(0, value)).padStart(minDigits, "0");
  return (
    <span className="inline-flex flex-col items-center" style={{ gap: "0.28em" }}>
      <span className="inline-flex" style={{ gap: "0.1em" }}>
        {str.split("").map((ch, i) => <Digit key={i} ch={ch} />)}
      </span>
      <span style={{ fontSize: "0.16em", letterSpacing: "0.34em", opacity: 0.55, fontFamily: "'IBM Plex Mono', monospace", marginLeft: "0.3em" }}>
        {label}
      </span>
    </span>
  );
}

export default function NeonCountdown({
  remain,
  palette,
}: {
  remain: { d: number; h: number; m: number; s: number } | null; // null = 마감
  // 그룹별 색 4개 [일, 시, 분, 초] — 주면 일이 진하고 초로 갈수록 옅어지는 그라데이션.
  // 일이 숨겨지면(0일) [일, 분, 초] 색을 시·분·초에 배정해 낙차를 유지한다. 없으면 currentColor 상속.
  palette?: [string, string, string, string];
}) {
  const r = remain ?? { d: 0, h: 0, m: 0, s: 0 };
  const groups: { value: number; label: string; minDigits?: number }[] = [];
  if (r.d > 0) groups.push({ value: r.d, label: "일", minDigits: r.d >= 10 ? 2 : 1 });
  groups.push({ value: r.h, label: "시" }, { value: r.m, label: "분" }, { value: r.s, label: "초" });
  const colors = palette
    ? (groups.length === 4 ? palette : [palette[0], palette[2], palette[3]])
    : null;

  return (
    <span className="inline-flex items-start select-none" style={{ gap: "0.18em" }} suppressHydrationWarning
      role="timer" aria-label={remain ? `${r.d}일 ${r.h}시간 ${r.m}분 ${r.s}초 남음` : "마감"}>
      <style>{`
        @keyframes neonColonBlink { 0%, 100% { opacity: 1 } 50% { opacity: .25 } }
        .neon-colon { animation: neonColonBlink 1s steps(1) infinite; }
        @media (prefers-reduced-motion: reduce) { .neon-colon { animation: none } }
      `}</style>
      {groups.map((g, i) => (
        <span key={g.label} className="inline-flex items-start" style={{ gap: "0.18em", ...(colors ? { color: colors[i] } : {}) }}>
          {i > 0 && <Colon />}
          <Group value={g.value} label={g.label} minDigits={g.minDigits} />
        </span>
      ))}
    </span>
  );
}
