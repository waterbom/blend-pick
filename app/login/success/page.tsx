import Link from "next/link";

export default function LoginSuccessPage() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <p className="text-4xl mb-4">🎉</p>
        <h1 className="text-2xl font-black mb-2">로그인 성공!</h1>
        <p className="text-sm text-gray-400">BLEND PICK에 오신 걸 환영해요</p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/products"
          className="bg-black text-white text-sm font-bold px-8 py-3 hover:bg-gray-800 transition-colors"
        >
          쇼핑하기
        </Link>
        <Link
          href="/mypage"
          className="border border-black text-sm font-bold px-8 py-3 hover:bg-gray-50 transition-colors"
        >
          마이페이지
        </Link>
      </div>
    </main>
  );
}
