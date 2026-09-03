import type { Metadata } from "next";
import SanjiHero from "@/components/sanji/SanjiHero";
import SanjiWhy from "@/components/sanji/SanjiWhy";

export const metadata: Metadata = { title: "산지픽 이야기" };

// 산지픽 브랜드 소개 — 예전 루트 랜딩(히어로 + WHY)을 /about 으로 옮겨둔 것.
// 루트(/)는 바로 판매 페이지라서, 광고·검색용 브랜드 스토리는 여기서 보여준다.
export default function SanjiAbout() {
  return (
    <main style={{ background: "#0b150e", minHeight: "100svh" }}>
      <SanjiHero />
      <SanjiWhy />
    </main>
  );
}
