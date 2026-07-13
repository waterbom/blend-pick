"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [redirect, setRedirect] = useState("");

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("redirect");
    if (r && r.startsWith("/")) setRedirect(r);
  }, []);

  async function handleEmailLogin(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!data.ok) {
      setError(data.error);
      return;
    }

    window.location.href = redirect || data.redirect || "/";
  }

  const inputCls =
    "w-full rounded-xl px-4 py-3 text-sm border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] transition-colors";

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="block text-center text-2xl font-extrabold tracking-tight mb-10"
          style={{ color: "var(--text-primary)" }}
        >
          BLEND PICK
        </Link>

        <p className="text-center text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          간편하게 시작해요
        </p>

        {/* 카카오 로그인 */}
        <a
          href={`/api/auth/kakao${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
          className="w-full bg-[#FEE500] text-[#191600] py-4 text-sm font-bold hover:brightness-95 transition-all flex items-center justify-center gap-2 rounded-xl"
        >
          <span>💬</span> 카카오로 시작하기
        </a>

        {/* 구분선 */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 border-t" style={{ borderColor: "var(--line)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>또는</span>
          <div className="flex-1 border-t" style={{ borderColor: "var(--line)" }} />
        </div>

        {/* 이메일 로그인 */}
        <form onSubmit={handleEmailLogin} className="space-y-3">
          <input
            type="text"
            placeholder="이메일 또는 아이디"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputCls}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputCls}
          />
          {error && <p className="text-xs" style={{ color: "var(--sale)" }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-3.5 text-sm font-bold rounded-xl transition-all hover:brightness-95 disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "로그인 중..." : "이메일로 로그인"}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          아직 계정이 없나요?{" "}
          <Link href="/signup" className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>
            회원가입
          </Link>
        </p>

        <p className="text-center text-xs mt-10" style={{ color: "var(--text-muted)" }}>
          로그인 시 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
        </p>
      </div>
    </main>
  );
}
