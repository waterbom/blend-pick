"use client";

import { useState } from "react";

interface Buyer {
  name: string;
  phone: string;
  paid_label: string;
}

// "010-1234-5678" → "010-12**-56**" (화면 표시용 마스킹 — 복사 시엔 전체 번호)
function maskPhone(phone: string) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length < 10) return phone;
  const mid = d.slice(3, d.length - 4);
  const last = d.slice(-4);
  return `${d.slice(0, 3)}-${mid.slice(0, 2)}${"*".repeat(Math.max(mid.length - 2, 0))}-${last.slice(0, 2)}**`;
}

const COUNTS = [
  { key: 5, label: "5명" },
  { key: 10, label: "10명" },
  { key: 20, label: "20명" },
  { key: 0, label: "전체" },
] as const;

// 상품공구 카드의 선착순 구매자 — 유효 결제만, 전화번호 중복 제거, 결제 승인시간 순
export default function FirstBuyersClient({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buyers, setBuyers] = useState<Buyer[] | null>(null);
  const [count, setCount] = useState<number>(5);
  const [copied, setCopied] = useState(false);

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (buyers) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/influencer/first-buyers?product_id=${productId}`);
      const d = await res.json();
      setBuyers(Array.isArray(d.buyers) ? d.buyers : []);
    } catch {
      setBuyers([]);
    } finally {
      setLoading(false);
    }
  }

  const visible = buyers ? (count === 0 ? buyers : buyers.slice(0, count)) : [];

  async function copyList() {
    // 이름␉전체번호 — 엑셀/스프레드시트에 붙이면 두 열로 나뉨
    const text = visible.map((b) => `${b.name}\t${b.phone}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("복사에 실패했어요. 다시 시도해주세요.");
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: "var(--surface-soft)", color: "var(--accent)", border: "1px solid var(--line)" }}
      >
        {open ? "선착순 접기 ▴" : "선착순 확인하기 ▾"}
      </button>

      {open && (
        <div className="mt-2 rounded-xl p-3" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)" }}>
          {loading || buyers === null ? (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>불러오는 중...</p>
          ) : buyers.length === 0 ? (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>아직 내 링크로 결제한 구매자가 없어요</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>선착순 구매자</span>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="text-xs border rounded-lg px-2 py-1"
                  style={{ borderColor: "var(--line)", color: "var(--text-primary)", background: "#fff" }}
                >
                  {COUNTS.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={copyList}
                  className={`text-xs font-bold px-3 py-1 rounded-lg text-white transition-colors ${copied ? "bg-green-600" : "bg-orange-500 hover:bg-orange-600"}`}
                >
                  {copied ? "✓ 복사됨" : "복사하기"}
                </button>
                <span className="text-[11px] ml-auto" style={{ color: "var(--text-muted)" }}>
                  유효 결제 {buyers.length}명 (중복·취소 제외)
                </span>
              </div>
              <ol className="space-y-1">
                {visible.map((b, i) => (
                  <li key={i} className="text-xs tnum flex gap-2" style={{ color: "var(--text-primary)" }}>
                    <span className="w-6 text-right" style={{ color: "var(--text-muted)" }}>{i + 1}.</span>
                    <span className="font-medium w-20 truncate">{b.name}</span>
                    <span style={{ color: "var(--text-muted)" }}>{maskPhone(b.phone)}</span>
                    <span className="ml-auto" style={{ color: "var(--text-muted)" }}>{b.paid_label}</span>
                  </li>
                ))}
              </ol>
              <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
                · 복사하면 선택 인원의 이름과 전체 번호가 엑셀 2열 형식으로 복사돼요
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
