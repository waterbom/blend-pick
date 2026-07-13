"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FallbackImg from "@/components/FallbackImg";

interface Candidate {
  product_id: string;
  name: string;
  brand: string | null;
  product_image: string | null;
  price: number;
  end_date: string;
}

// 인플루언서 셀프 공구 등록 — 진행중 공구 목록에서 선택해 내 공구로 포크
export default function InfluencerForkClient() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function openPanel() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (list === null) {
      const res = await fetch("/api/influencer/campaigns");
      if (res.ok) setList(await res.json());
      else setList([]);
    }
  }

  async function fork(c: Candidate) {
    if (!window.confirm(`"${c.name}" 공구를 시작할까요?\n등록되면 내 전용 링크가 만들어져요.`)) return;
    setBusy(c.product_id);
    const res = await fetch("/api/influencer/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: c.product_id }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) {
      setList((prev) => (prev ? prev.filter((x) => x.product_id !== c.product_id) : prev));
      setOpen(false);
      setList(null); // 다음에 열 때 새로 조회
      router.refresh(); // 내 공구 목록(RSC) 갱신
    } else {
      alert(d.error || "등록 실패");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPanel}
        className="w-full text-sm font-bold py-3 rounded-2xl transition-all hover:brightness-95"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        {open ? "닫기" : "+ 공구 등록하기"}
      </button>

      {open && (
        <div className="mt-3 rounded-2xl p-4 bg-white" style={{ border: "1px solid var(--line)" }}>
          <p className="text-xs font-bold mb-3" style={{ color: "var(--text-muted)" }}>
            현재 진행중인 공구 — 선택하면 내 공구로 등록되고 전용 링크가 생겨요
          </p>
          {list === null ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>불러오는 중...</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
              지금 참여할 수 있는 공구가 없어요
            </p>
          ) : (
            <div className="space-y-2">
              {list.map((c) => (
                <div
                  key={c.product_id}
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{ background: "var(--surface-soft)", border: "1px solid var(--line)" }}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0" style={{ background: "#fff" }}>
                    <FallbackImg src={c.product_image} alt={c.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                    <p className="text-xs tnum" style={{ color: "var(--text-muted)" }}>
                      {c.brand && `${c.brand} · `}{Number(c.price).toLocaleString()}원 · ~{c.end_date}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fork(c)}
                    disabled={busy !== null}
                    className="text-xs font-bold px-3 py-2 rounded-lg shrink-0 text-white disabled:opacity-40"
                    style={{ background: "var(--accent)" }}
                  >
                    {busy === c.product_id ? "등록 중..." : "공구 시작"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
