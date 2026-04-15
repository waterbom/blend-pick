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
        className="text-xs text-red-400 hover:text-red-600 transition-colors"
      >
        회원탈퇴
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-gray-900 mb-2">회원탈퇴</h3>
            <p className="text-sm text-gray-500 mb-1">
              탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.
            </p>
            <p className="text-sm text-gray-700 font-medium mb-4">
              아래에 <strong>확인했습니다</strong> 를 입력해주세요.
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="확인했습니다"
              className="w-full border border-gray-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setOpen(false);
                  setInput("");
                }}
                className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-500 rounded-sm hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleWithdraw}
                disabled={input !== "확인했습니다" || loading}
                className="flex-1 py-2.5 bg-red-500 text-white text-sm font-bold rounded-sm hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
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
