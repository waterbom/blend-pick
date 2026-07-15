import Header from "@/components/Header";
import ReservationLookupClient from "@/components/ReservationLookupClient";

// 카카오톡 등 공유 시 미리보기 (오픈그래프)
export const metadata = {
  title: "예약 조회 · BLEND PICK",
  description: "여수 UTOP 마리나 호텔 공동구매 — 예약번호와 휴대폰 인증으로 예약 확인·취소를 바로 하실 수 있어요.",
  openGraph: {
    title: "여수 UTOP 마리나 호텔 — 예약 조회 · BLEND PICK",
    description: "예약번호 + 예약자 휴대폰 인증으로 예약 확인과 취소(환불 규정 자동 적용)가 가능합니다.",
    url: "https://shop.blendpunch.com/hotel/lookup",
    siteName: "BLEND PICK",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "https://shop.blendpunch.com/og-hotel.png", width: 1200, height: 630, alt: "여수 UTOP 마리나 호텔 오션뷰 객실" }],
  },
};

export default function ReservationLookupPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <ReservationLookupClient />
    </main>
  );
}
