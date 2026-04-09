import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <Link href="/" className="block text-center text-2xl font-black tracking-tighter mb-10">
          BLEND PICK
        </Link>

        <p className="text-center text-sm text-gray-400 mb-8">
          간편하게 시작해요
        </p>

        {/* 카카오 로그인 버튼 */}
        <a
          href="/api/auth/kakao"
          className="w-full bg-yellow-400 text-black py-4 text-sm font-bold hover:bg-yellow-300 transition-colors flex items-center justify-center gap-2 rounded-sm"
        >
          <span>💬</span> 카카오로 시작하기
        </a>

        <p className="text-center text-xs text-gray-300 mt-10">
          로그인 시 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
        </p>

        <p className="text-center text-xs text-gray-400 mt-4">
          <Link href="/" className="hover:text-black transition-colors">
            홈으로 돌아가기
          </Link>
        </p>
      </div>
    </main>
  );
}
