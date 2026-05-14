"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEmailLogin(e: React.FormEvent) {
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

    router.push(data.redirect || "/");
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="block text-center text-2xl font-black tracking-tighter mb-10"
        >
          BLEND PICK
        </Link>

        <p className="text-center text-sm text-gray-400 mb-8">
          간편하게 시작해요
        </p>

        {/* 카카오 로그인 */}
        <a
          href="/api/auth/kakao"
          className="w-full bg-yellow-400 text-black py-4 text-sm font-bold hover:bg-yellow-300 transition-colors flex items-center justify-center gap-2 rounded-sm"
        >
          <span>💬</span> 카카오로 시작하기
        </a>

        {/* 구분선 */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 border-t border-gray-100" />
          <span className="text-xs text-gray-300">또는</span>
          <div className="flex-1 border-t border-gray-100" />
        </div>

        {/* 이메일 로그인 */}
        <form onSubmit={handleEmailLogin} className="space-y-3">
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
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 text-sm font-bold hover:bg-gray-800 transition-colors rounded-sm disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "이메일로 로그인"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          아직 계정이 없나요?{" "}
          <Link
            href="/signup"
            className="text-black font-medium hover:underline"
          >
            회원가입
          </Link>
        </p>

        <p className="text-center text-xs text-gray-300 mt-10">
          로그인 시 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
        </p>
      </div>
    </main>
  );
}
