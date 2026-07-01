"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WithdrawButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleWithdraw() {
    setLoading(true);
    const res = await fetch("/api/auth/withdraw", { method: "POST" });
    const data = await res.json();
    setLoading(false);

    if (data.ok) {
      router.push("/");
    } else {
      alert(data.error || "오류가 발생했습니다.");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs transition-colors hover:underline"
        style={{ color: "var(--sale)" }}
      >
        회원탈퇴
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" style={{ boxShadow: "var(--card-shadow-hover)" }}>
            <h3 className="font-bold mb-2" style={{ color: "var(--text-primary)" }}>회원탈퇴</h3>
            <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>
              탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.
            </p>
            <p className="text-sm font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
              아래에 <strong>확인했습니다</strong> 를 입력해주세요.
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="확인했습니다"
              className="w-full rounded-xl px-4 py-3 text-sm border border-[var(--line)] focus:outline-none focus:border-[var(--sale)] transition-colors mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setOpen(false);
                  setInput("");
                }}
                className="flex-1 py-2.5 text-sm rounded-xl transition-colors hover:brightness-95"
                style={{ border: "1px solid var(--line)", color: "var(--text-secondary)", background: "#fff" }}
              >
                취소
              </button>
              <button
                onClick={handleWithdraw}
                disabled={input !== "확인했습니다" || loading}
                className="flex-1 py-2.5 text-white text-sm font-bold rounded-xl transition-all hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--sale)" }}
              >
                {loading ? "처리 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
