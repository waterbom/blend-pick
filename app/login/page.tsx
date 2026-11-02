"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/SiteContext";
import { internalReturnPath } from "@/lib/buyer-flow";
import { apiErrorMessage, readApiJson } from "@/lib/api-error-message";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [redirect, setRedirect] = useState("");
  const submitting = useRef(false);

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("redirect");
    if (r) setRedirect(internalReturnPath(r));
  }, []);

  async function handleEmailLogin(e: React.SyntheticEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await readApiJson(res, "로그인하지 못했습니다. 잠시 후 다시 시도해주세요.");
      if (data.ok !== true) throw new Error("로그인 결과를 확인하지 못했습니다. 다시 시도해주세요.");
      window.location.href = data.isAdmin ? "/admin" : internalReturnPath(redirect || data.redirect || "/");
    } catch (cause) {
      setError(apiErrorMessage(cause, "로그인하지 못했습니다. 잠시 후 다시 시도해주세요."));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
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
            <form onSubmit={handleEmailLogin} className="flex flex-col gap-3" aria-busy={loading}>
              <div>
                <label className="ds-label" htmlFor="login-email">이메일</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-describedby={error ? "login-error" : undefined}
                  className="ds-input"
                />
              </div>
              <div>
                <label className="ds-label" htmlFor="login-password">비밀번호</label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-describedby={error ? "login-error" : undefined}
                  className="ds-input"
                />
              </div>
              {error && <p id="login-error" role="alert" className="text-sm leading-relaxed" style={{ color: "var(--sale)", overflowWrap: "anywhere" }}>{error}</p>}
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

