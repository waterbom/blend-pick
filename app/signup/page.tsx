"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "verify">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    <main className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="block text-center text-2xl font-black tracking-tighter mb-10"
        >
          BLEND PICK
        </Link>

        {step === "form" ? (
          <>
            <p className="text-center text-sm text-gray-400 mb-8">
              이메일로 회원가입
            </p>
            <form onSubmit={handleSignup} className="space-y-3">
              <input
                type="text"
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
              <input
                type="email"
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
              <input
                type="password"
                placeholder="비밀번호 (8자 이상)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="w-full border border-gray-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
              <input
                type="password"
                placeholder="비밀번호 확인"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />

              {/* 약관 동의 */}
              <div className="border border-gray-100 rounded-sm p-4 space-y-3 mt-2">
                {/* 전체 동의 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allAgreed}
                    onChange={(e) => handleAllAgree(e.target.checked)}
                    className="w-4 h-4 accent-black"
                  />
                  <span className="text-sm font-semibold">전체 동의</span>
                </label>

                <div className="border-t border-gray-100 pt-3 space-y-2">
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
                      className="w-4 h-4 accent-black"
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
                      className="w-4 h-4 accent-black"
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
                      className="w-4 h-4 accent-black"
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
                      className="w-4 h-4 accent-black"
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
                      className="w-4 h-4 accent-black"
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
                className="w-full bg-black text-white py-3 text-sm font-bold hover:bg-gray-800 transition-colors rounded-sm disabled:opacity-50"
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
                className="w-full border border-gray-200 rounded-sm px-4 py-3 text-sm text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-black"
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white py-3 text-sm font-bold hover:bg-gray-800 transition-colors rounded-sm disabled:opacity-50"
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
            className="text-black font-medium hover:underline"
          >
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
