"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/SiteContext";

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

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-[520px] ds-card">
        {/* 상단 브랜드 밴드 */}
        <Link href="/" className="flex items-center justify-center h-16" style={{ background: "var(--accent-hover)" }}>
          <BrandMark onDark size={17} />
        </Link>

        <div className="px-8 sm:px-14 pt-12 pb-10">
          <div className="ds-caption mb-3">MEMBER LOGIN</div>
          <h1 className="ds-serif text-[26px] font-semibold m-0" style={{ color: "var(--text-primary)" }}>로그인</h1>

          <div className="mt-7 flex flex-col gap-3">
            {/* 카카오 로그인 */}
            <a
              href={`/api/auth/kakao${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
              className="ds-btn"
              style={{ background: "#FAE100", color: "#3C1E1E" }}
            >
              카카오로 3초 만에 시작
            </a>

            {/* 구분선 */}
            <div className="flex items-center gap-3.5 my-2">
              <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>또는 이메일로</span>
              <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
            </div>

            {/* 이메일 로그인 */}
            <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
              <div>
                <label className="ds-label">이메일</label>
                <input
                  type="text"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="ds-input"
                />
              </div>
              <div>
                <label className="ds-label">비밀번호</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="ds-input"
                />
              </div>
              {error && <p className="text-xs" style={{ color: "var(--sale)" }}>{error}</p>}
              <button type="submit" disabled={loading} className="ds-btn ds-btn-primary mt-2">
                {loading ? "로그인 중..." : "로그인"}
              </button>
            </form>
          </div>

          <div className="flex justify-between mt-5 text-xs" style={{ color: "#6B7263" }}>
            <span>로그인 시 이용약관에 동의하게 됩니다</span>
            <span>
              아직 회원이 아니신가요?{" "}
              <Link href="/signup" className="font-semibold" style={{ color: "var(--accent)" }}>
                회원가입
              </Link>
            </span>
          </div>
        </div>

        <div className="px-8 sm:px-14 py-4 text-[11px]" style={{ borderTop: "1px solid var(--line)", color: "var(--text-muted)" }}>
          비회원으로 주문하셨나요?{" "}
          <Link href="/orders/lookup" className="font-semibold underline" style={{ color: "var(--accent)" }}>
            휴대폰 인증으로 주문 조회
          </Link>
        </div>
      </div>
    </main>
  );
}
