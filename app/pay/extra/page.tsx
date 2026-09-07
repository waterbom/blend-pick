import { currentSite } from "@/lib/site-server";
import { SITES } from "@/lib/sites";
import Link from "next/link";
import ExtraPayClient from "@/components/ExtraPayClient";
import { verifyPayLink } from "@/lib/pay-link";

// 카카오톡 공유 미리보기 — 링크가 사기처럼 보이지 않게 금액·용도까지 표시
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const info = t ? await verifyPayLink(t) : null;
  const site = info ? SITES[info.site] : await currentSite();
  const title = `추가 결제 · ${site.nameEn}`;
  const description = info
    ? `${info.label} · ${info.amount.toLocaleString()}원 — ${site.name} 공식 결제 페이지에서 카드로 안전하게 결제하실 수 있어요.`
    : `${site.name} 공식 결제 페이지 — 금액 확인 후 카드로 안전하게 결제하실 수 있어요.`;
  return {
    title,
    description,
    openGraph: {
      title: info ? `추가 결제 ${info.amount.toLocaleString()}원 · ${site.nameEn}` : title,
      description,
      url: `https://${site.host}/pay/extra`,
      siteName: site.nameEn,
      type: "website",
      locale: "ko_KR",
      images: [{ url: `https://${site.host}${site.key === "sanjipick" ? "/sanji/og.png" : "/og-pay.png"}`, width: 1200, height: 630, alt: `${site.name} 추가 결제` }],
    },
  };
}

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

  if (!info || info.site !== (await currentSite()).key) {
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
