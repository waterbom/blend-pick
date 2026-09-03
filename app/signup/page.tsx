"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/SiteContext";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "verify">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [redirect, setRedirect] = useState("");

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("redirect");
    if (r && r.startsWith("/")) setRedirect(r);
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [code, setCode] = useState("");

  const [allAgreed, setAllAgreed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);
  const [smsAgreed, setSmsAgreed] = useState(false);
  const [emailMarketingAgreed, setEmailMarketingAgreed] = useState(false);

  function handleAllAgree(checked: boolean) {
    setAllAgreed(checked);
    setTermsAgreed(checked);
    setPrivacyAgreed(checked);
    setMarketingAgreed(checked);
    setSmsAgreed(checked);
    setEmailMarketingAgreed(checked);
  }

  function syncAllAgreed(
    terms: boolean,
    privacy: boolean,
    marketing: boolean,
    sms: boolean,
    emailMkt: boolean
  ) {
    setAllAgreed(terms && privacy && marketing && sms && emailMkt);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!termsAgreed || !privacyAgreed) {
      setError("필수 약관에 동의해주세요.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        marketing_agreed: marketingAgreed,
        sms_agreed: smsAgreed,
        email_marketing_agreed: emailMarketingAgreed,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!data.ok) {
      setError(data.error);
      return;
    }
    setStep("verify");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    setLoading(false);

    if (!data.ok) {
      setError(data.error);
      return;
    }
    router.push("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="block text-center text-2xl font-extrabold tracking-tight mb-10"
          style={{ color: "var(--text-primary)" }}
        >
          <span className="inline-flex justify-center"><BrandMark size={22} /></span>
        </Link>

        {step === "form" ? (
          <>
            {/* 카카오톡 1초 가입 (카카오 로그인 = 자동 가입) */}
            <a
              href={`/api/auth/kakao${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
              className="sj-kakao w-full bg-[#FEE500] text-[#191600] py-4 text-sm font-bold hover:brightness-95 transition-all flex items-center justify-center gap-2 rounded-xl"
            >
              <span>💬</span> 카카오톡 1초 가입
            </a>
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 border-t" style={{ borderColor: "var(--line)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>또는 이메일로 가입</span>
              <div className="flex-1 border-t" style={{ borderColor: "var(--line)" }} />
            </div>
            <form onSubmit={handleSignup} className="space-y-3">
              <input
                type="text"
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl px-4 py-3 text-sm border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <input
                type="email"
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl px-4 py-3 text-sm border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <input
                type="password"
                placeholder="비밀번호 (8자 이상)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="w-full rounded-xl px-4 py-3 text-sm border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <input
                type="password"
                placeholder="비밀번호 확인"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                className="w-full rounded-xl px-4 py-3 text-sm border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />

              {/* 약관 동의 */}
              <div className="rounded-xl p-4 space-y-3 mt-2" style={{ border: "1px solid var(--line)" }}>
                {/* 전체 동의 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allAgreed}
                    onChange={(e) => handleAllAgree(e.target.checked)}
                    className="w-4 h-4 accent-[#2D5A27]"
                  />
                  <span className="text-sm font-semibold">전체 동의</span>
                </label>

                <div className="pt-3 space-y-2" style={{ borderTop: "1px solid var(--line)" }}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={termsAgreed}
                      onChange={(e) => {
                        setTermsAgreed(e.target.checked);
                        syncAllAgreed(
                          e.target.checked,
                          privacyAgreed,
                          marketingAgreed,
                          smsAgreed,
                          emailMarketingAgreed
                        );
                      }}
                      className="w-4 h-4 accent-[#2D5A27]"
                    />
                    <span className="text-xs text-gray-700">
                      [필수] 이용약관 동의
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privacyAgreed}
                      onChange={(e) => {
                        setPrivacyAgreed(e.target.checked);
                        syncAllAgreed(
                          termsAgreed,
                          e.target.checked,
                          marketingAgreed,
                          smsAgreed,
                          emailMarketingAgreed
                        );
                      }}
                      className="w-4 h-4 accent-[#2D5A27]"
                    />
                    <span className="text-xs text-gray-700">
                      [필수] 개인정보 수집 및 이용 동의
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marketingAgreed}
                      onChange={(e) => {
                        setMarketingAgreed(e.target.checked);
                        syncAllAgreed(
                          termsAgreed,
                          privacyAgreed,
                          e.target.checked,
                          smsAgreed,
                          emailMarketingAgreed
                        );
                      }}
                      className="w-4 h-4 accent-[#2D5A27]"
                    />
                    <span className="text-xs text-gray-500">
                      [선택] 쇼핑정보 수신 동의
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smsAgreed}
                      onChange={(e) => {
                        setSmsAgreed(e.target.checked);
                        syncAllAgreed(
                          termsAgreed,
                          privacyAgreed,
                          marketingAgreed,
                          e.target.checked,
                          emailMarketingAgreed
                        );
                      }}
                      className="w-4 h-4 accent-[#2D5A27]"
                    />
                    <span className="text-xs text-gray-500">
                      [선택] SMS 수신 동의
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailMarketingAgreed}
                      onChange={(e) => {
                        setEmailMarketingAgreed(e.target.checked);
                        syncAllAgreed(
                          termsAgreed,
                          privacyAgreed,
                          marketingAgreed,
                          smsAgreed,
                          e.target.checked
                        );
                      }}
                      className="w-4 h-4 accent-[#2D5A27]"
                    />
                    <span className="text-xs text-gray-500">
                      [선택] 이메일 수신 동의
                    </span>
                  </label>
                </div>
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="sj-primary w-full text-white py-3.5 text-sm font-bold rounded-xl transition-all hover:brightness-95 disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                {loading ? "처리 중..." : "인증 코드 받기"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-center text-sm text-gray-400 mb-2">
              인증 코드 입력
            </p>
            <p className="text-center text-xs text-gray-400 mb-8">
              <strong>{email}</strong>로 발송된 6자리 코드를 입력해주세요
            </p>
            <form onSubmit={handleVerify} className="space-y-3">
              <input
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                required
                className="w-full rounded-xl px-4 py-3 text-sm text-center tracking-widest text-lg border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="sj-primary w-full text-white py-3.5 text-sm font-bold rounded-xl transition-all hover:brightness-95 disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                {loading ? "확인 중..." : "인증 완료"}
              </button>
              <button
                type="button"
                onClick={() => setStep("form")}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-2"
              >
                이메일 다시 입력
              </button>
            </form>
          </>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          이미 계정이 있나요?{" "}
          <Link
            href="/login"
            className="font-semibold hover:underline"
            style={{ color: "var(--accent)" }}
          >
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
