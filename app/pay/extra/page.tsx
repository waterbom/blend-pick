import Link from "next/link";
import ExtraPayClient from "@/components/ExtraPayClient";
import { verifyPayLink } from "@/lib/pay-link";

export const metadata = { title: "추가 결제 · BLEND PICK" };

// 숨은 결제 경로 — 링크(서명 토큰)로만 접근. 내비게이션에 노출 안 함.
export default async function ExtraPayPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const info = t ? await verifyPayLink(t) : null;
  const clientKey = process.env.TOSS_CLIENT_KEY!;

  // 딥 포레스트 리디자인 전용 폰트 (세리프 헤드라인 · 모노 금액)
  const fonts = (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
    </>
  );

  if (!info) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "#FFFFFF" }}>
        {fonts}
        <div className="text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-sm font-bold" style={{ fontFamily: "'Noto Serif KR', serif", color: "#1C2418" }}>유효하지 않은 결제 링크예요.</p>
          <p className="text-xs mt-1" style={{ color: "#8B927F" }}>링크가 만료되었거나 잘못되었습니다. 담당자에게 문의해주세요.</p>
          <Link href="/" className="inline-block mt-5 text-xs" style={{ color: "#244B1F" }}>← 홈으로</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10" style={{ background: "#FFFFFF" }}>
      {fonts}
      <ExtraPayClient clientKey={clientKey} token={t!} amount={info.amount} label={info.label} />
    </main>
  );
}
